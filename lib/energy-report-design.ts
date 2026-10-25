import type { EnergySnapshot } from './energy-metrics';

/** Information explicitly reviewed by administration, separate from measured energy. */
export type EnergyReportDetails = {
  client: string; technician: string; location: string; systemType: string;
  modules: string; equipment: string; capacity: string;
  expectedDaily: number | null; reference: string;
  measurementSource?: string; interpretation?: string;
};
export function validateReportDetails(raw: unknown): EnergyReportDetails | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Revisa los datos del informe.');
  const input = raw as Record<string, unknown>;
  const text = (key: string, max = 120) => {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > max) throw new Error('Revisa los datos del informe.');
    return value.trim();
  };
  const expectedDaily = input.expectedDaily == null || input.expectedDaily === '' ? null : input.expectedDaily;
  if (expectedDaily !== null && (typeof expectedDaily !== 'number' || !Number.isFinite(expectedDaily) || expectedDaily <= 0 || expectedDaily > 1e9)) throw new Error('La referencia diaria debe ser un número positivo en kWh.');
  const reference = text('reference', 300);
  if (expectedDaily !== null && !reference) throw new Error('Documenta el origen de la generación esperada.');
  return {client:text('client'),technician:text('technician'),location:text('location'),systemType:text('systemType'),modules:text('modules',30),equipment:text('equipment'),capacity:text('capacity',40),expectedDaily,reference,measurementSource:text('measurementSource',120),interpretation:text('interpretation',600)};
}
export function reportPerformance(s: EnergySnapshot) {
  const days = s.daily.length;
  const reference = s.reportDetails?.expectedDaily;
  const expected = typeof reference === 'number' && Number.isFinite(reference) && reference > 0 ? reference * days : null;
  const complete = days > 0 && s.daily.every(d => d.count === 1440 / s.options.interval);
  return {days, expected, complete, compliance: complete && expected ? s.totals.production / expected * 100 : null, difference: complete && expected ? s.totals.production - expected : null};
}
