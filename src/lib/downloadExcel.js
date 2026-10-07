import * as XLSX from 'xlsx';

export function downloadExcel(filename, headers, rows, sheetName = 'Members') {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const columnCount = headers.length;

  sheet['!cols'] = headers.map((header, columnIndex) => {
    const longestValue = rows.reduce((length, row) => Math.max(length, String(row[columnIndex] ?? '').length), String(header).length);
    return { wch: Math.min(Math.max(longestValue + 2, 12), 48) };
  });

  if (sheet['!ref']) sheet['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(columnCount - 1)}${rows.length + 1}` };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, filename, { bookType: 'xlsx', compression: true });
}
