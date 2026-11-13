/*
 * Students in and out of Excel, for a center that keeps its list there.
 *
 * The template is three columns, name, phone and (optional) e-mail, with one filled-in example row. Reading is
 * forgiving about the shape it gets back: headers in either order, in Uzbek or Russian, or no
 * header at all — then the column whose cells look like phone numbers is the phone. Every row
 * goes into the add dialog to be checked before anything is sent, so a bad cell is something
 * the admin fixes on screen, not a failed upload.
 *
 * Both libraries are loaded on use. They are only for this one button, and the panel's entry
 * chunk should not carry a spreadsheet parser for everybody who never presses it.
 */

export type ImportedStudent = { name: string; phone: string; email: string }

const NAME_HEADER = 'Ism va familiya'
const PHONE_HEADER = 'Telefon raqam'
const EMAIL_HEADER = 'Email (ixtiyoriy)'

/** Too many for one dialog, and more than any center's limit; the server takes 500 at a time. */
const MAX_ROWS = 500

export async function downloadStudentsTemplate() {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  await writeXlsxFile(
    [
      [
        { value: NAME_HEADER, fontWeight: 'bold' },
        { value: PHONE_HEADER, fontWeight: 'bold' },
        { value: EMAIL_HEADER, fontWeight: 'bold' },
      ],
      // Typed as text so Excel keeps the spaces and does not turn the number into 9.01E+08.
      [
        { value: 'Ali Valiyev', type: String },
        { value: '90 123 45 67', type: String },
        { value: 'ali@gmail.com', type: String },
      ],
    ],
    { columns: [{ width: 32 }, { width: 20 }, { width: 30 }], sheet: "O'quvchilar" },
  ).toFile('oquvchilar-shablon.xlsx')
}

const cellText = (value: unknown) => (value === null || value === undefined ? '' : String(value).trim())

const looksLikePhone = (value: string) => value.replace(/\D/g, '').length >= 9 && /^[+\d\s()-]+$/.test(value)

export async function readStudentsFile(file: File): Promise<ImportedStudent[]> {
  if (!/\.xlsx$/i.test(file.name)) {
    throw new Error(".xlsx fayl tanlang (Excel). Eski .xls bo'lsa, Excel'da .xlsx qilib saqlang.")
  }

  const { readSheet } = await import('read-excel-file/browser')
  let rows: unknown[][]
  try {
    rows = (await readSheet(file)) as unknown[][]
  } catch {
    throw new Error("Faylni o'qib bo'lmadi. Shablonni yuklab oling va shunga to'ldiring.")
  }

  const table = rows.map((row) => row.map(cellText)).filter((row) => row.some(Boolean))
  if (table.length === 0) return []

  // A header row is one with no phone in it; find the columns by their names, if it has them.
  const header = table[0].some(looksLikePhone) ? null : table[0].map((cell) => cell.toLowerCase())
  const body = header ? table.slice(1) : table

  const find = (words: string[]) => header?.findIndex((cell) => words.some((word) => cell.includes(word))) ?? -1
  let phoneColumn = find(['telefon', 'raqam', 'phone', 'телефон', 'номер'])
  let nameColumn = find(['ism', 'name', 'fio', 'имя', 'фио'])
  let emailColumn = find(['email', 'e-mail', 'pochta', 'почта'])

  // No usable header: the phone column is the one most of whose cells are phone numbers.
  if (phoneColumn < 0) {
    const width = Math.max(...body.map((row) => row.length))
    let best = -1
    let bestCount = 0
    for (let column = 0; column < width; column++) {
      const count = body.filter((row) => looksLikePhone(row[column] ?? '')).length
      if (count > bestCount) {
        best = column
        bestCount = count
      }
    }
    phoneColumn = best
  }

  if (phoneColumn < 0) throw new Error("Telefon raqamlar ustuni topilmadi. Shablondagi «Telefon raqam» ustunini to'ldiring.")
  if (nameColumn < 0 || nameColumn === phoneColumn) nameColumn = phoneColumn === 0 ? 1 : 0
  // No e-mail header: a column whose cells hold an @ is the e-mail.
  if (emailColumn < 0) {
    const width = Math.max(...body.map((row) => row.length))
    for (let column = 0; column < width; column++) {
      if (column !== phoneColumn && column !== nameColumn && body.some((row) => (row[column] ?? '').includes('@'))) {
        emailColumn = column
        break
      }
    }
  }

  const students = body
    .map((row) => ({
      name: row[nameColumn] ?? '',
      phone: row[phoneColumn] ?? '',
      email: emailColumn >= 0 ? (row[emailColumn] ?? '') : '',
    }))
    .filter((student) => student.name || student.phone)

  if (students.length > MAX_ROWS) {
    throw new Error(`Faylda ${students.length} ta qator bor — bir martada ${MAX_ROWS} tagacha yuklang.`)
  }

  return students
}
