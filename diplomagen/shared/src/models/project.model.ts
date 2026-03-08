export type FontFamily = 'PTSerif' | 'PTSans' | 'Roboto' | 'OpenSans' | 'TimesNewRoman';
export type TextAlign = 'left' | 'center' | 'right';

export interface FieldStyle {
  fontFamily: FontFamily;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  align: TextAlign;
}

export interface FieldPosition {
  x: number;
  y: number;
}

export interface Field {
  id: string;
  label: string;
  excelColumn: string | null;
  staticValue: string | null;
  position: FieldPosition | null;
  style: FieldStyle;
}

export interface TemplateMetadata {
  storageUrl: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  widthPx: number;
  heightPx: number;
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  template: TemplateMetadata | null;
  excelColumns: string[];
  excelDataPath: string | null;
  totalRows: number | null;
  fields: Field[];
}

/** Lightweight version returned in project list (no storageUrl) */
export interface ProjectListItem {
  id: string;
  name: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  template: Omit<TemplateMetadata, 'storageUrl'> | null;
}
