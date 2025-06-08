// Tipos de usuario y autenticación
export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
  employeeId?: string;
}

export interface AuthRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Tipos de empleado
export interface Employee {
  id: string;
  identification: string;
  firstName: string;
  lastName: string;
  areaId?: string;
  position?: string;
  baseSalary?: number;
  isActive: boolean;
}

// Tipos de área
export interface Area {
  id: string;
  name: string;
  defaultEntryTime: string;
  defaultExitTime: string;
  defaultLunchDuration: number;
  defaultWorkingHours: number;
}

// Tipos de asistencia
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: Date;
  entryTime?: string;
  exitTime?: string;
  lunchDuration?: number;
  workedHours?: number;
  isVacation: boolean;
  permissionHours?: number;
  permissionReason?: string;
}

// Tipos para requests
export interface CreateEmployeeRequest {
  identification: string;
  firstName: string;
  lastName: string;
  areaId?: string;
  position?: string;
  baseSalary?: number;
}

export interface CreateAttendanceRequest {
  employeeId: string;
  date: string;
  entryTime?: string;
  exitTime?: string;
  lunchDuration?: number;
  isVacation?: boolean;
  permissionHours?: number;
  permissionReason?: string;
}

// Agregar a Express Request
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
