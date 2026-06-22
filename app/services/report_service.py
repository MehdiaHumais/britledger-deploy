class ReportService:
    def __init__(self, db, user_id):
        self.db = db
        self.user_id = user_id
    async def profit_loss(self, date_from, date_to): return {}
    async def revenue_summary(self, date_from, date_to): return {}
    async def expense_summary(self, date_from, date_to): return {}
    async def yearly_report(self, year, fiscal_year_start): return {"year": year}
