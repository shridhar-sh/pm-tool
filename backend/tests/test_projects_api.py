"""
Backend API tests for Project Management Tool
Tests project CRUD operations and workflow stages
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data prefix for cleanup
TEST_PREFIX = "TEST_"


class TestHealthCheck:
    """Health check and basic API tests"""
    
    def test_api_root_reachable(self):
        """Verify API is reachable"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"API Root Response: {data}")


class TestProjectsCRUD:
    """Project CRUD operations tests"""
    
    def test_get_projects_list(self):
        """Test listing all projects"""
        response = requests.get(f"{BASE_URL}/api/projects")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} projects")
        
    def test_create_project_success(self):
        """Test creating a new project with workflow stages"""
        project_data = {
            "name": f"{TEST_PREFIX}Test Project Timeline",
            "client": "Test Client",
            "sow": "Test scope of work",
            "csDoneBy": "Test CS",
            "projectStartDate": "2026-02-01",
            "projectEndDate": "2026-03-01",
            "statusCategory": "strategy",
            "assignedAM": "Test AM",
            "assignedLP": "Test LP",
            "pod": "POD 1"
        }
        
        response = requests.post(f"{BASE_URL}/api/projects", json=project_data)
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["name"] == project_data["name"]
        assert data["client"] == project_data["client"]
        assert data["projectStartDate"] == project_data["projectStartDate"]
        assert "workflowStages" in data
        assert isinstance(data["workflowStages"], list)
        assert len(data["workflowStages"]) > 0, "Project should have default workflow stages"
        
        print(f"Created project with {len(data['workflowStages'])} workflow stages")
        
        # Verify by GET
        project_id = data["id"]
        get_response = requests.get(f"{BASE_URL}/api/projects/{project_id}")
        assert get_response.status_code == 200
        fetched_project = get_response.json()
        assert fetched_project["id"] == project_id
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/projects/{project_id}")
        
    def test_create_project_missing_required_fields(self):
        """Test creating project without required fields"""
        project_data = {
            "name": f"{TEST_PREFIX}Incomplete Project"
            # Missing required fields
        }
        
        response = requests.post(f"{BASE_URL}/api/projects", json=project_data)
        assert response.status_code == 422, "Should fail validation for missing fields"
        print("Correctly rejected incomplete project data")
        
    def test_get_single_project(self):
        """Test getting a single project by ID"""
        # First create a project
        project_data = {
            "name": f"{TEST_PREFIX}Get Single Test",
            "client": "Test Client",
            "sow": "Test SOW",
            "csDoneBy": "CS",
            "projectStartDate": "2026-02-01",
            "projectEndDate": "2026-03-01",
            "statusCategory": "strategy"
        }
        create_response = requests.post(f"{BASE_URL}/api/projects", json=project_data)
        assert create_response.status_code == 200
        project_id = create_response.json()["id"]
        
        # Get the project
        get_response = requests.get(f"{BASE_URL}/api/projects/{project_id}")
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["id"] == project_id
        assert data["name"] == project_data["name"]
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/projects/{project_id}")
        
    def test_get_nonexistent_project(self):
        """Test getting a project that doesn't exist"""
        response = requests.get(f"{BASE_URL}/api/projects/nonexistent-id-12345")
        assert response.status_code == 404
        print("Correctly returned 404 for non-existent project")
        
    def test_update_project_workflow_stages(self):
        """Test updating project workflow stages (key feature for timeline)"""
        # Create project
        project_data = {
            "name": f"{TEST_PREFIX}Update Stages Test",
            "client": "Test Client",
            "sow": "Test SOW",
            "csDoneBy": "CS",
            "projectStartDate": "2026-02-01",
            "projectEndDate": "2026-03-01",
            "statusCategory": "strategy"
        }
        create_response = requests.post(f"{BASE_URL}/api/projects", json=project_data)
        assert create_response.status_code == 200
        project = create_response.json()
        project_id = project["id"]
        
        # Update workflow stages with duration values (simulating timeline auto-calculation)
        updated_stages = project["workflowStages"][:3]  # Take first 3 stages
        updated_stages[0]["duration"] = 2
        updated_stages[0]["startDate"] = "2026-02-01"
        updated_stages[0]["endDate"] = "2026-02-02"
        updated_stages[1]["duration"] = 3
        updated_stages[1]["startDate"] = "2026-02-03"
        updated_stages[1]["endDate"] = "2026-02-05"
        updated_stages[2]["duration"] = 2
        updated_stages[2]["extraDays"] = 1  # Add extra day
        updated_stages[2]["startDate"] = "2026-02-06"
        updated_stages[2]["endDate"] = "2026-02-08"
        
        update_response = requests.patch(
            f"{BASE_URL}/api/projects/{project_id}",
            json={"workflowStages": updated_stages}
        )
        assert update_response.status_code == 200
        updated_project = update_response.json()
        
        # Verify stages were updated
        stages = updated_project["workflowStages"]
        assert stages[0]["duration"] == 2
        assert stages[1]["duration"] == 3
        assert stages[2]["extraDays"] == 1
        
        print("Successfully updated workflow stages with durations and extra days")
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/projects/{project_id}")
        persisted_project = get_response.json()
        assert persisted_project["workflowStages"][2]["extraDays"] == 1
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/projects/{project_id}")
        
    def test_update_single_stage(self):
        """Test updating a single workflow stage"""
        # Create project
        project_data = {
            "name": f"{TEST_PREFIX}Stage Update Test",
            "client": "Test Client",
            "sow": "Test SOW",
            "csDoneBy": "CS",
            "projectStartDate": "2026-02-01",
            "projectEndDate": "2026-03-01",
            "statusCategory": "strategy"
        }
        create_response = requests.post(f"{BASE_URL}/api/projects", json=project_data)
        project_id = create_response.json()["id"]
        
        # Update single stage
        stage_update = {
            "duration": 5,
            "startDate": "2026-02-01",
            "endDate": "2026-02-05",
            "completed": True
        }
        
        update_response = requests.patch(
            f"{BASE_URL}/api/projects/{project_id}/stages/0",
            json=stage_update
        )
        assert update_response.status_code == 200
        data = update_response.json()
        assert "stage" in data
        assert data["stage"]["duration"] == 5
        assert data["stage"]["completed"] == True
        
        print("Successfully updated single stage")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/projects/{project_id}")
        
    def test_delete_project(self):
        """Test deleting a project"""
        # Create project
        project_data = {
            "name": f"{TEST_PREFIX}Delete Test",
            "client": "Test Client",
            "sow": "Test SOW",
            "csDoneBy": "CS",
            "projectStartDate": "2026-02-01",
            "projectEndDate": "2026-03-01",
            "statusCategory": "strategy"
        }
        create_response = requests.post(f"{BASE_URL}/api/projects", json=project_data)
        project_id = create_response.json()["id"]
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/projects/{project_id}")
        assert delete_response.status_code == 200
        
        # Verify deleted
        get_response = requests.get(f"{BASE_URL}/api/projects/{project_id}")
        assert get_response.status_code == 404
        print("Successfully deleted project")


class TestTeamMembersAPI:
    """Team members API tests"""
    
    def test_get_team_members(self):
        """Test listing team members"""
        response = requests.get(f"{BASE_URL}/api/team-members")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} team members")


class TestWorkflowStagesDefaults:
    """Tests for default workflow stages creation"""
    
    def test_project_created_with_default_stages(self):
        """Verify new project gets default workflow stages"""
        project_data = {
            "name": f"{TEST_PREFIX}Default Stages Test",
            "client": "Test Client",
            "sow": "Test SOW",
            "csDoneBy": "CS",
            "projectStartDate": "2026-02-01",
            "projectEndDate": "2026-03-01",
            "statusCategory": "strategy"
        }
        
        response = requests.post(f"{BASE_URL}/api/projects", json=project_data)
        assert response.status_code == 200
        project = response.json()
        
        stages = project["workflowStages"]
        assert len(stages) > 0
        
        # Check expected stage structure
        first_stage = stages[0]
        assert "name" in first_stage
        assert "taskType" in first_stage
        assert "department" in first_stage
        assert "duration" in first_stage
        assert "extraDays" in first_stage
        assert "startDate" in first_stage
        assert "endDate" in first_stage
        
        # Check for expected default stages
        stage_names = [s["name"] for s in stages]
        assert "Onboarding Form" in stage_names
        assert "Scripts" in stage_names
        assert "Shoot" in stage_names
        
        print(f"Project created with {len(stages)} default stages")
        print(f"Stage names: {stage_names[:5]}...")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/projects/{project['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
