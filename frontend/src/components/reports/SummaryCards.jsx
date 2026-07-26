import {
  People,
  AccountBalanceWallet,
  TrendingUp,
  AccessTime,
  MoneyOff,
} from "@mui/icons-material";

export default function SummaryCards({ data }) {
  if (!data) return null;

  const cards = [
    {
      title: "Total Payroll",
      value: data.totalPayroll,
      icon: AccountBalanceWallet,
      color: "text-blue-600",
      bg: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      title: "Employees Paid",
      value: data.employeesPaid,
      icon: People,
      color: "text-green-600",
      bg: "bg-green-100 dark:bg-green-900/30",
    },
    {
      title: "Average Salary",
      value: data.averageSalary,
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-100 dark:bg-purple-900/30",
    },
    {
      title: "Total Overtime",
      value: data.overtime,
      icon: AccessTime,
      color: "text-orange-600",
      bg: "bg-orange-100 dark:bg-orange-900/30",
    },
    {
      title: "Total Deductions",
      value: data.deductions,
      icon: MoneyOff,
      color: "text-red-600",
      bg: "bg-red-100 dark:bg-red-900/30",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.title}
            className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {card.title}
                </p>

                <h2 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                  {card.value}
                </h2>
              </div>

              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${card.bg}`}
              >
                <Icon className={card.color} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}