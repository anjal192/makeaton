from app.database import Base, engine

# Stubs must be imported BEFORE models so the referenced tables exist
import app.modules.billing.stubs
import app.modules.billing.models

Base.metadata.create_all(engine)
print("Tables created:")
for name in sorted(Base.metadata.tables):
    print(" -", name)
    