class BookkeepingService:
    def __init__(self, db, user_id):
        self.db = db
        self.user_id = user_id
    async def create_expense(self, payload): return {"id": "00000000-0000-0000-0000-000000000000"}
    async def get_expense_by_id(self, expense_id): return {"id": expense_id}
    async def update_expense(self, expense_id, payload): return {"id": expense_id}
    async def delete_expense(self, expense_id): pass
    async def list_expenses(self, **kwargs):
        return {"success": True, "data": [], "total": 0, "page": 1, "page_size": 20, "total_pages": 0}
    async def list_transactions(self, **kwargs):
        return {"success": True, "data": [], "total": 0, "page": 1, "page_size": 20, "total_pages": 0}
    async def list_ledger(self, **kwargs):
        return {"success": True, "data": [], "total": 0, "page": 1, "page_size": 20, "total_pages": 0}
    async def get_vat_summary(self, *args):
        return {"box1": 0}
    async def list_vat_records(self, **kwargs):
        return {"success": True, "data": [], "total": 0, "page": 1, "page_size": 20, "total_pages": 0}
