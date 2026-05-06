import type { Freq } from "./transforms";

export interface Filters {
  dateFrom: string;
  dateTo: string;
  freq: Freq;
  selectedTypes: string[];
  managerIds: string[];
  utmSources: string[];
  utmMediums: string[];
}
