"""Create the first ADMIN account:  python -m scripts.create_admin you@example.com "Full Name"
The password is read from the prompt (never from argv / history)."""
import getpass
import sys

from sqlalchemy import select

from app.database import SessionLocal
from app.models import User
from app.security import hash_password
from app.utils.validators import validate_password_strength

if len(sys.argv) < 3:
    sys.exit('usage: python -m scripts.create_admin EMAIL "FULL NAME"')
email, name = sys.argv[1].lower(), sys.argv[2]
pw = getpass.getpass("Password: ")
validate_password_strength(pw)
with SessionLocal() as db:
    if db.scalar(select(User).where(User.email == email)):
        sys.exit("User already exists")
    db.add(User(full_name=name, email=email, role="ADMIN", hashed_password=hash_password(pw)))
    db.commit()
print("Admin created")
