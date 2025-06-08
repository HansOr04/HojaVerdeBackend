import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  // Crear areas por defecto
  const areas = await Promise.all([
    prisma.area.create({
      data: {
        name: 'CULTIVO 1',
        defaultEntryTime: new Date('1970-01-01T06:30:00'),
        defaultExitTime: new Date('1970-01-01T16:00:00'),
        defaultLunchDuration: 30,
        defaultWorkingHours: 8
      }
    }),
    prisma.area.create({
      data: {
        name: 'CULTIVO 2',
        defaultEntryTime: new Date('1970-01-01T06:30:00'),
        defaultExitTime: new Date('1970-01-01T16:00:00'),
        defaultLunchDuration: 30,
        defaultWorkingHours: 8
      }
    }),
    prisma.area.create({
      data: {
        name: 'CULTIVO 3',
        defaultEntryTime: new Date('1970-01-01T06:30:00'),
        defaultExitTime: new Date('1970-01-01T16:00:00'),
        defaultLunchDuration: 30,
        defaultWorkingHours: 8
      }
    }),
    prisma.area.create({
      data: {
        name: 'CULTIVO 4',
        defaultEntryTime: new Date('1970-01-01T06:30:00'),
        defaultExitTime: new Date('1970-01-01T16:00:00'),
        defaultLunchDuration: 30,
        defaultWorkingHours: 8
      }
    }),
    prisma.area.create({
      data: {
        name: 'POSTCOSECHA',
        defaultEntryTime: new Date('1970-01-01T07:00:00'),
        defaultExitTime: new Date('1970-01-01T17:00:00'),
        defaultLunchDuration: 30,
        defaultWorkingHours: 8
      }
    })
  ]);

  console.log(areas.length + ' areas creadas');

  // Crear empleado admin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const adminEmployee = await prisma.employee.create({
    data: {
      identification: '1234567890',
      firstName: 'Admin',
      lastName: 'Sistema',
      position: 'Administrador',
      baseSalary: 1000,
      areaId: areas[0].id,
      user: {
        create: {
          email: 'admin@hojaverde.com',
          password: hashedPassword,
          role: 'ADMIN'
        }
      }
    },
    include: {
      user: true
    }
  });

  console.log('Usuario admin creado: ' + adminEmployee.user?.email);

  // Crear algunos empleados de ejemplo
  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        identification: '1003520929',
        firstName: 'ALICIA MARICELA',
        lastName: 'ALAJO LECHON',
        position: 'Trabajador Agricola',
        baseSalary: 450,
        areaId: areas[0].id
      }
    }),
    prisma.employee.create({
      data: {
        identification: '0804677771',
        firstName: 'CARLOS ANTONIO',
        lastName: 'ALCIVAR MENDOZA',
        position: 'Trabajador Agricola',
        baseSalary: 450,
        areaId: areas[3].id
      }
    }),
    prisma.employee.create({
      data: {
        identification: '0401720735',
        firstName: 'KAREN LILIANA',
        lastName: 'ALPALA NAZATE',
        position: 'Trabajador Agricola',
        baseSalary: 450,
        areaId: areas[2].id
      }
    })
  ]);

  console.log(employees.length + ' empleados de ejemplo creados');
  console.log('Seed completado exitosamente!');
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });