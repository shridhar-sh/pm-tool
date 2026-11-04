"""Derive dashboard status from saved stage progress, consistently for all clients."""


def is_completed(stage):
    return bool(stage["completed"]) if "completed" in stage else stage.get("status") == "completed"


def progress_signature(stages):
    return [(s.get("name"), is_completed(s), bool(s.get("started")),
             s.get("status", "not_started")) for s in stages]


def workflow_status(stages):
    if not stages or not any(is_completed(s) or s.get("started") or
                             s.get("status") == "in_progress" for s in stages):
        return "yet_to_start"
    pending = [s for s in stages if not is_completed(s)]
    if not pending:
        return "closed"
    stage = pending[0]
    if stage.get("name") == "Revision":
        return "correction_ongoing"
    return stage.get("department") or {
        "Onboarding": "strategy", "Strategy": "strategy", "Strategy Approval": "strategy",
        "Products": "strategy", "Pre Production": "pre_production", "PPM": "pre_production",
        "Shoot": "production", "Edits": "post_production", "Feedback": "post_production",
        "Revision": "correction_ongoing", "Final Approval": "post_production",
    }.get(stage.get("name"), "yet_to_start")
