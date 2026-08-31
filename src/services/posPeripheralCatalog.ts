/**
 * POS Terminal Hardware Peripheral Diagnostic Catalog (Printer, Scanner, Pinpad)
 */

export const POS_HARDWARE_PERIPHERALS_CATALOG = [
  { peripheralId: 'PRINTER-THERMAL-01', peripheralName: 'Epson Thermal Receipt Printer', isConnected: true, paperRollLevelPercent: 85 },
  { peripheralId: 'SCANNER-2D-BARCODE', peripheralName: 'Zebra 2D Barcode Reader', isConnected: true, paperRollLevelPercent: 100 },
  { peripheralId: 'PINPAD-PCI-EMV', peripheralName: 'Verifone PCI-EMV Smart Pinpad', isConnected: true, paperRollLevelPercent: 100 },
];

/**
 * Validates POS terminal hardware peripheral connectivity and thermal receipt paper roll level.
 */
export function validatePosPeripheralStatus(peripheralId: string): boolean {
  const match = POS_HARDWARE_PERIPHERALS_CATALOG.find(p => p.peripheralId === peripheralId);
  return match ? match.isConnected && match.paperRollLevelPercent >= 10 : false;
}
