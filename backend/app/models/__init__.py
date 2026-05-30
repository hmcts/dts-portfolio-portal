# Models are imported here so Alembic's autogenerate picks them up via
# SQLModel.metadata. Each new entity in Group D adds an import.
from app.models.activity_entry import ActivityEntry  # noqa: F401
from app.models.ai_parse_metric import AiParseMetric  # noqa: F401
from app.models.initiative import Initiative  # noqa: F401
from app.models.jurisdiction import Jurisdiction  # noqa: F401
from app.models.product import OutboundLink, Product  # noqa: F401
from app.models.product_domain import ProductDomain, StrategicTheme  # noqa: F401
from app.models.search_event import SearchEvent  # noqa: F401
from app.models.team import Team  # noqa: F401

# Relationship declarations must be imported last — declaring them before the
# table classes would cause circular imports.  The "# isort: split" directive
# below creates a separate import block so ruff doesn't reorder relationships
# ahead of the models it references.
# isort: split
import app.models.relationships  # noqa: F401
