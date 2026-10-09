import { useCallback, useEffect, useState } from "react";
import { API } from "@/lib/api";

const SEASONS = ["spring", "summer", "autumn", "winter"];

export const IgSeasonalLibrary = ({ token }) => {
  const [data, setData] = useState(null);
  const q = `token=${encodeURIComponent(token)}`;

  const load = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`${API}/instagram/seasonal-bgs?${q}`);
    if (r.ok) setData(await r.json());
  }, [token, q]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!data?.job?.running) return undefined;
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [data?.job?.running, load]);

  const regenerate = async () => {
    await fetch(`${API}/instagram/seasonal-bgs/pregenerate?${q}`, { method: "POST" });
    setTimeout(load, 1000);
  };

  if (!data) return null;
  const slugs = [...new Set(data.grid.map((g) => g.slug))];
  const ready = data.grid.filter((g) => g.square && g.vertical).length;
  const job = data.job;

  return (
    <section className="mt-10" data-testid="admin-ig-seasonal-library">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="font-serif text-2xl text-forest">Seasonal watercolours</h2>
          <p className="text-sm text-ink/70 mt-1" data-testid="admin-ig-seasonal-summary">
            {ready}/{data.grid.length} masterclass × season variants ready · current season{" "}
            <strong className="text-terracotta">{data.current_season}</strong>
            {job.running && ` · generating ${job.done}/${job.total}…`}
            {!job.running && job.failed?.length > 0 && ` · ${job.failed.length} failed`}
          </p>
        </div>
        <button
          onClick={regenerate}
          disabled={job.running}
          data-testid="admin-ig-seasonal-generate"
          className="btn-ghost disabled:opacity-50"
        >
          {job.running ? "Generating…" : "Fill missing variants"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="admin-ig-seasonal-grid">
          <thead>
            <tr className="text-left text-moss">
              <th className="py-2 pr-3 font-normal">Masterclass</th>
              {SEASONS.map((s) => (
                <th key={s} className={`py-2 px-2 font-normal capitalize ${s === data.current_season ? "text-terracotta" : ""}`}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slugs.map((slug) => (
              <tr key={slug} className="border-t border-border">
                <td className="py-2 pr-3 font-serif text-forest whitespace-nowrap">{slug}</td>
                {SEASONS.map((season) => {
                  const cell = data.grid.find((g) => g.slug === slug && g.season === season);
                  return (
                    <td key={season} className="py-2 px-2" data-testid={`admin-ig-bg-${slug}-${season}`}>
                      {cell?.square ? (
                        <img
                          src={`${API}/instagram/seasonal-bgs/thumb?${q}&slug=${slug}&season=${season}`}
                          alt={`${slug} ${season}`}
                          loading="lazy"
                          className="w-24 h-24 object-cover rounded"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded bg-sand border border-dashed border-border grid place-items-center text-xs text-moss">
                          pending
                        </div>
                      )}
                      {cell && !cell.vertical && <p className="text-[10px] text-moss mt-1">reel bg pending</p>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
