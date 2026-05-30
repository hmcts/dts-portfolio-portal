# Models are imported here so Alembic's autogenerate picks them up via
# SQLModel.metadata. Each new entity in Group D adds an import.
from app.models.jurisdiction import Jurisdiction  # noqa: F401
from app.models.product_domain import ProductDomain, StrategicTheme  # noqa: F401
from app.models.team import Team  # noqa: F401
