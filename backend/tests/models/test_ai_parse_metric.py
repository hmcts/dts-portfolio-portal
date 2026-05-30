from sqlalchemy import select

from app.models.ai_parse_metric import AiParseMetric


async def test_ai_parse_metric_round_trips(db_session):
    metric = AiParseMetric(
        id="apm_d7_test",
        source="azure-openai",
        outcome="success",
        latency_ms=250,
    )
    db_session.add(metric)
    await db_session.flush()

    result = await db_session.execute(
        select(AiParseMetric).where(AiParseMetric.id == "apm_d7_test")
    )
    found = result.scalar_one()
    assert found.source == "azure-openai"
    assert found.latency_ms == 250
