import type { Freq } from "./transforms";

export interface Filters {
  dateFrom: string;          // empty string = no creation-date filter
  dateTo: string;
  freq: Freq;
  selectedTypes: string[];
  managerIds: string[];
  utmSources: string[];
  utmMediums: string[];
  firstPaymentFrom: string;  // empty string = no first-payment filter
  firstPaymentTo: string;
}
