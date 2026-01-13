"""
Database connection and session management for saved routes feature.

Handles PostgreSQL/PostGIS connection using SQLAlchemy.
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from contextlib import contextmanager
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database availability flag
DATABASE_AVAILABLE = True

# Database configuration
# Can be overridden by environment variable
DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://localhost:5432/curvature'  # Default local connection
)

# Create SQLAlchemy engine
# pool_pre_ping=True ensures connections are alive before using
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    echo=False  # Set to True for SQL query logging during development
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@contextmanager
def get_db():
    """
    Context manager for database sessions.

    Usage:
        with get_db() as db:
            route = db.query(SavedRoute).filter_by(route_id=1).first()
            # ... do work ...
        # Session is automatically committed and closed
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        db.close()


def get_db_session():
    """
    Get a database session (for dependency injection in FastAPI).

    Usage in FastAPI:
        @app.get("/routes")
        def get_routes(db: Session = Depends(get_db_session)):
            return db.query(SavedRoute).all()
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    """
    Initialize database tables.

    Creates all tables defined in models.py if they don't exist.
    This is a convenience function - for production, use Alembic migrations.
    """
    from api.models.orm import Base

    try:
        logger.info("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully!")
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        raise


def check_db_connection():
    """
    Check if database connection is working.

    Returns:
        bool: True if connection successful, False otherwise
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection successful")
        return True
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return False


def test_postgis():
    """
    Test if PostGIS extension is available.

    Returns:
        bool: True if PostGIS is available, False otherwise
    """
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT PostGIS_Version();"))
            version = result.fetchone()[0]
            logger.info(f"PostGIS version: {version}")
            return True
    except Exception as e:
        logger.error(f"PostGIS not available: {e}")
        logger.error("Make sure to run: CREATE EXTENSION postgis;")
        return False


if __name__ == "__main__":
    """
    Run this module directly to initialize the database.

    Usage:
        python -m api.database
    """
    print("Checking database connection...")
    if check_db_connection():
        print("✓ Database connection OK")

        print("\nChecking PostGIS extension...")
        if test_postgis():
            print("✓ PostGIS extension OK")
        else:
            print("✗ PostGIS extension not found")
            print("  Run: psql <database> -c 'CREATE EXTENSION postgis;'")

        print("\nInitializing database tables...")
        init_db()
        print("✓ Database initialization complete!")
    else:
        print("✗ Database connection failed")
        print(f"  Check DATABASE_URL: {DATABASE_URL}")
