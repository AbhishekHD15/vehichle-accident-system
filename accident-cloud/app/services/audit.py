from sqlalchemy.orm import Session

from ..models import AuditLog


def log(db: Session, user_id: int | None, action: str, entity_type: str, entity_id,
        previous=None, new=None) -> None:
    db.add(AuditLog(user_id=user_id, action=action, entity_type=entity_type,
                    entity_id=str(entity_id), previous_value=previous, new_value=new))
