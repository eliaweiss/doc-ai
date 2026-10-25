"use client";

import { useDataSources } from "../context/DataSourcesProvider";
import { DataSourceCard } from "./DataSourceCard";

export function DataSourcesList() {
  const { dataSources, drivers } = useDataSources();

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6"
      data-testid="data-sources-list"
    >
      {dataSources.map((ds) => {
        const manifest = drivers.find((d) => d.driverType === ds.driverType);
        return (
          <DataSourceCard
            key={ds.id}
            dataSource={ds}
            manifest={manifest}
          />
        );
      })}
    </div>
  );
}
