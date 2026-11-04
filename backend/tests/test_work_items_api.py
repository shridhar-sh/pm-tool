"""Local API integration tests. Isolated Mongo-compatible store, or unique disposable databases via PM_TEST_MONGO_URL."""
import os
import unittest
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
os.environ.setdefault('MONGO_URL', 'mongodb://localhost:27017')
os.environ.setdefault('DB_NAME', 'pm_tool_test')
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient
from backend import server


class WorkItemsAPI(unittest.TestCase):
    def setUp(self):
        self.db_name = 'pm_automated_test_' + uuid.uuid4().hex
        self.mongo = AsyncIOMotorClient(os.environ['PM_TEST_MONGO_URL']) if os.environ.get('PM_TEST_MONGO_URL') else AsyncMongoMockClient()
        server.db = self.mongo[self.db_name]
        self.client = TestClient(server.app)
        self.client.__enter__()
        response = self.client.post('/api/projects', json={
            'name': 'Film', 'client': 'Client', 'sow': 'Video', 'csDoneBy': 'CS',
            'projectStartDate': '2026-11-04', 'projectEndDate': '2026-11-30',
            'statusCategory': 'yet_to_start', 'assignedAM': 'Account Manager',
        })
        self.assertEqual(response.status_code, 200, response.text)
        self.project = response.json()
        self.pid = self.project['id']

    def tearDown(self):
        self.client.portal.call(self.mongo.drop_database, self.db_name)
        self.mongo.close()
        self.client.__exit__(None, None, None)

    def task(self, **extra):
        payload = dict(projectId=self.pid, title='Edit first cut', assignedTo='Editor', dueDate='2026-11-12')
        payload.update(extra)
        response = self.client.post('/api/tasks', json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_task_shared_across_project_and_personal_views(self):
        task = self.task()
        self.assertEqual(self.client.get(f'/api/tasks/project/{self.pid}').json()[0]['id'], task['id'])
        self.assertEqual(self.client.get('/api/tasks/user/Editor').json()[0]['id'], task['id'])
        saved = self.client.patch(f'/api/tasks/{task["id"]}', json={'completed': True}).json()
        self.assertTrue(saved['completed'])
        self.assertIsNotNone(saved['completedAt'])
        self.assertTrue(self.client.get(f'/api/tasks/project/{self.pid}').json()[0]['completed'])
        saved = self.client.patch(f'/api/tasks/{task["id"]}', json={'completed': False}).json()
        self.assertIsNone(saved['completedAt'])

    def test_rename_and_reassignment_do_not_duplicate_data(self):
        task = self.task(projectName='Stale client supplied name')
        self.client.patch(f'/api/projects/{self.pid}', json={'name': 'New film name'})
        self.assertEqual(self.client.get('/api/tasks/user/Editor').json()[0]['projectName'], 'New film name')
        self.client.patch(f'/api/tasks/{task["id"]}', json={'assignedTo': 'Second Editor'})
        self.assertEqual(self.client.get('/api/tasks/user/Editor').json(), [])
        self.assertEqual(len(self.client.get('/api/tasks/user/Second%20Editor').json()), 1)

    def test_approval_review_persists_and_cannot_be_overwritten(self):
        response = self.client.post('/api/approvals', json={
            'projectId': self.pid, 'title': 'First cut', 'approver': 'AM', 'type': 'client'})
        self.assertEqual(response.status_code, 200, response.text)
        approval = response.json()
        review = self.client.patch(f'/api/approvals/{approval["id"]}', json={
            'status': 'approved', 'reviewedBy': 'AM', 'reviewedAt': 'untrusted client time'})
        self.assertEqual(review.status_code, 200, review.text)
        self.assertNotEqual(review.json()['reviewedAt'], 'untrusted client time')
        self.assertEqual(self.client.get(f'/api/approvals/project/{self.pid}').json()[0]['status'], 'approved')
        self.assertEqual(self.client.patch(f'/api/approvals/{approval["id"]}', json={
            'status': 'rejected', 'reviewedBy': 'AM'}).status_code, 409)

    def test_missing_projects_and_invalid_inputs_are_rejected(self):
        self.assertEqual(self.client.get('/api/tasks/project/missing').status_code, 404)
        self.assertEqual(self.client.post('/api/tasks', json={
            'projectId': 'missing', 'title': 'Task', 'assignedTo': 'Editor', 'dueDate': '2026-11-12'}).status_code, 404)
        self.assertEqual(self.client.post('/api/tasks', json={
            'projectId': self.pid, 'title': 'Task', 'assignedTo': 'Editor', 'dueDate': 'bad'}).status_code, 422)
        self.assertEqual(self.client.patch('/api/tasks/missing', json={'completed': True}).status_code, 404)
        self.assertEqual(self.client.patch('/api/approvals/missing', json={'status': 'approved', 'reviewedBy': 'AM'}).status_code, 404)

    def test_deleting_project_removes_its_work_items(self):
        task = self.task()
        self.client.post('/api/approvals', json={'projectId': self.pid, 'title': 'Review', 'approver': 'AM'})
        self.assertEqual(self.client.delete(f'/api/projects/{self.pid}').status_code, 200)
        self.assertEqual(self.client.get('/api/tasks/user/Editor').json(), [])
        self.assertEqual(self.client.patch(f'/api/tasks/{task["id"]}', json={'completed': True}).status_code, 404)

    def test_stage_progress_is_authoritative_in_every_project_read(self):
        self.client.patch(f'/api/projects/{self.pid}/stages/0', json={'completed': True})
        detail = self.client.get(f'/api/projects/{self.pid}').json()
        self.assertEqual(detail['statusCategory'], 'strategy')
        self.assertEqual(detail['workflowStages'][0]['status'], 'completed')
        self.assertEqual(self.client.get('/api/projects').json()[0]['statusCategory'], 'strategy')
        self.client.patch(f'/api/projects/{self.pid}/stages/0', json={'completed': False})
        self.assertEqual(self.client.get(f'/api/projects/{self.pid}').json()['statusCategory'], 'yet_to_start')
        self.assertEqual(self.client.patch(f'/api/projects/{self.pid}/stages/-1', json={'completed': True}).status_code, 404)

    def test_bulk_progress_advances_and_reopens(self):
        stages = self.project['workflowStages']
        for stage in stages:
            stage['completed'] = True
        saved = self.client.patch(f'/api/projects/{self.pid}', json={'workflowStages': stages, 'statusCategory': 'production'}).json()
        self.assertEqual(saved['statusCategory'], 'closed')
        stages[-1]['completed'] = False
        saved = self.client.patch(f'/api/projects/{self.pid}', json={'workflowStages': stages}).json()
        self.assertEqual(saved['statusCategory'], 'post_production')

    def test_stage_boundaries_advance_without_updating_dashboard_separately(self):
        stages = self.project['workflowStages']
        for boundary, expected in [(4, 'pre_production'), (6, 'production'), (7, 'post_production'), (9, 'correction_ongoing'), (11, 'closed')]:
            for index, stage in enumerate(stages):
                stage['completed'] = index < boundary
            saved = self.client.patch(f'/api/projects/{self.pid}', json={'workflowStages': stages}).json()
            self.assertEqual(saved['statusCategory'], expected)

    def test_timeline_only_edits_preserve_manual_status_and_markers(self):
        stages = self.project['workflowStages']
        stages[0]['duration'] = 2
        self.client.patch(f'/api/projects/{self.pid}', json={
            'statusCategory': 'pre_production', 'workflowStages': stages,
            'workingDays': {'2026-11-07': True}, 'extraDayMarkers': {'2026-11-06': True},
            'stageOverlaps': {'1': -1}})
        saved = self.client.get(f'/api/projects/{self.pid}').json()
        self.assertEqual(saved['statusCategory'], 'pre_production')
        self.assertEqual(saved['workingDays'], {'2026-11-07': True})
        self.assertEqual(saved['stageOverlaps'], {'1': -1})
        self.client.patch(f'/api/projects/{self.pid}/stages/0', json={'duration': 3})
        self.assertEqual(self.client.get(f'/api/projects/{self.pid}').json()['statusCategory'], 'pre_production')


if __name__ == '__main__':
    unittest.main()
