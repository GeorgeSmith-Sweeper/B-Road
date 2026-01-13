"""
Base repository pattern for database operations.
"""

from sqlalchemy.orm import Session
from typing import Generic, TypeVar, Type, Optional, List

ModelType = TypeVar("ModelType")


class BaseRepository(Generic[ModelType]):
    """Base repository with common CRUD operations."""

    def __init__(self, model: Type[ModelType], db: Session):
        self.model = model
        self.db = db

    def get(self, id: int) -> Optional[ModelType]:
        """Get entity by ID"""
        return self.db.query(self.model).filter_by(id=id).first()

    def get_all(self) -> List[ModelType]:
        """Get all entities"""
        return self.db.query(self.model).all()

    def create(self, entity: ModelType) -> ModelType:
        """Create new entity"""
        self.db.add(entity)
        self.db.flush()
        return entity

    def update(self, entity: ModelType) -> ModelType:
        """Update entity (entity must be attached to session)"""
        self.db.flush()
        return entity

    def delete(self, entity: ModelType) -> None:
        """Delete entity"""
        self.db.delete(entity)
        self.db.flush()
