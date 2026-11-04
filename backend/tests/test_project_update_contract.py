"""Persistence-contract regressions; no MongoDB or live server required."""
import unittest

from backend.project_models import ProjectUpdate


class ProjectUpdateContractTests(unittest.TestCase):
    def test_edit_form_fields_reach_the_database_update(self):
        payload = {
            'name': 'Campaign', 'client': 'Client', 'sow': '12 videos',
            'csDoneBy': 'Strategist', 'assignedAM': 'AM', 'assignedLP': 'LP',
            'pod': 'POD 2', 'projectStartDate': '2026-11-04',
            'projectEndDate': '2026-11-20',
        }
        self.assertEqual(ProjectUpdate(**payload).model_dump(exclude_none=True), payload)

    def test_marker_controls_survive_serialization(self):
        payload = {
            'extraDayMarkers': {'2026-11-05': True},
            'extraDayVisual': {'1-2026-11-05': True},
            'workingDays': {'2026-11-07': True},
            'workingDaysVisual': {'2-2026-11-07': True},
            'stageOverlaps': {'2': -1},
            'workflowStages': [{'name': 'Shoot', 'duration': 2}],
        }
        model = ProjectUpdate.model_validate_json(ProjectUpdate(**payload).model_dump_json())
        self.assertEqual(model.model_dump(exclude_none=True), payload)

    def test_empty_maps_remove_markers_and_empty_strings_clear_assignments(self):
        payload = {'extraDayMarkers': {}, 'workingDays': {}, 'stageOverlaps': {}, 'assignedLP': ''}
        self.assertEqual(ProjectUpdate(**payload).model_dump(exclude_none=True), payload)

    def test_partial_edits_do_not_erase_unsubmitted_fields(self):
        self.assertEqual(ProjectUpdate(name='Renamed').model_dump(exclude_none=True), {'name': 'Renamed'})

    def test_project_identity_cannot_be_overwritten(self):
        self.assertNotIn('id', ProjectUpdate(id='different', name='Renamed').model_dump())


if __name__ == '__main__':
    unittest.main()
