"""Gateway routing, allow-list, and the Letta assistant-JSON parser.

No network: these exercise the FastAPI surface + the parser against the exact message
shape the live Letta agents return (assistant_message.content = a JSON string).
"""
from fastapi.testclient import TestClient

from planner_gateway.main import _assistant_json, app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert set(body["agents"]) == {
        "weekly-report", "next-week-plan", "task-rewrite", "executive-analytics",
    }


def test_unknown_agent_404():
    assert client.post("/agents/nope/invoke", json={"message": "x"}).status_code == 404


def test_known_agent_503_without_letta_configured():
    # GATEWAY_LETTA_BASE_URL unset -> a clean 503, never a crash.
    assert client.post("/agents/weekly-report/invoke", json={"message": "x"}).status_code == 503


def test_assistant_json_parses_object():
    resp = {"messages": [{"message_type": "assistant_message", "content": '{"completed_summary": "done"}'}]}
    assert _assistant_json(resp) == {"completed_summary": "done"}


def test_assistant_json_falls_back_to_text():
    resp = {"messages": [{"message_type": "assistant_message", "content": "hello"}]}
    assert _assistant_json(resp) == {"text": "hello"}


def test_assistant_json_takes_last_assistant_ignoring_reasoning_and_tools():
    resp = {"messages": [
        {"message_type": "reasoning_message", "reasoning": "thinking"},
        {"message_type": "tool_call_message", "tool_call": {"name": "conversation_search"}},
        {"message_type": "assistant_message", "content": '{"n": 1}'},
        {"message_type": "assistant_message", "content": '{"n": 2}'},
    ]}
    assert _assistant_json(resp) == {"n": 2}


def test_assistant_json_empty_when_no_assistant_message():
    assert _assistant_json({"messages": [{"message_type": "reasoning_message", "reasoning": "x"}]}) == {}


def test_assistant_json_strips_markdown_fences():
    fenced = '```json\n{"summary": "all good", "risks": []}\n```'
    resp = {"messages": [{"message_type": "assistant_message", "content": fenced}]}
    assert _assistant_json(resp) == {"summary": "all good", "risks": []}


def test_assistant_json_extracts_object_from_surrounding_prose():
    prose = 'Here is the report:\n{"completed_summary": "done"}\nLet me know if you need more.'
    resp = {"messages": [{"message_type": "assistant_message", "content": prose}]}
    assert _assistant_json(resp) == {"completed_summary": "done"}


def test_assistant_json_text_fallback_when_not_json():
    resp = {"messages": [{"message_type": "assistant_message", "content": "no json here"}]}
    assert _assistant_json(resp) == {"text": "no json here"}
