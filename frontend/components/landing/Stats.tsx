const stats = [
  { value: '500+', label: 'Sites ativos' },
  { value: '10M+', label: 'Views por mês' },
  { value: '99.9%', label: 'Uptime garantido' },
  { value: '150+', label: 'Países alcançados' },
];

export default function Stats() {
  return (
    <section className="py-16 border-y border-gray-800/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl sm:text-4xl font-extrabold gradient-text mb-1">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
