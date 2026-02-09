import { Candidate, User, Campaign } from './types';

// Mock Database of Users
export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Miguel Ángel',
    email: 'miguel@symmetry.os',
    role: 'Director de Talento',
    avatar: 'https://i.pravatar.cc/150?u=miguel'
  },
  {
    id: 'u2',
    name: 'Sarah Connor',
    email: 'sarah@symmetry.os',
    role: 'Reclutadora',
    avatar: 'https://i.pravatar.cc/150?u=sarah'
  }
];

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'c1',
    platform: 'LinkedIn',
    title: 'Startups Flutter Q3',
    role: 'Desarrollador Flutter Senior',
    status: 'Running',
    createdAt: '01-10-2023',
    stats: { sent: 1250, responseRate: 12.4, leads: 42 }
  },
  {
    id: 'c2',
    platform: 'LinkedIn',
    title: 'Expansión Product Managers',
    role: 'Product Manager',
    status: 'Running',
    createdAt: '15-10-2023',
    stats: { sent: 400, responseRate: 8.5, leads: 15 }
  },
  {
    id: 'c3',
    platform: 'LinkedIn',
    title: 'Ventas Agresivas Q4',
    role: 'Ejecutivo de Cuentas',
    status: 'Paused',
    createdAt: '20-09-2023',
    stats: { sent: 2100, responseRate: 4.2, leads: 8 }
  }
];

export const MOCK_CANDIDATES: Candidate[] = [
  {
    id: '1',
    name: 'Elena Rodríguez',
    avatar: 'https://picsum.photos/id/1011/200/200',
    role: 'Desarrolladora Flutter Senior',
    company: 'FinTech Nova',
    status: 'Scheduled',
    aiAnalysis: 'Ha publicado 3 apps financieras. Fuerte arquitectura en Riverpod.',
    matchScore: 98,
    skills: ['Flutter', 'Dart', 'Riverpod', 'Firebase'],
    location: 'Madrid, ES',
    experience: '6 Años',
    education: 'Ingeniería Informática, UPM'
  },
  {
    id: '2',
    name: 'David Chen',
    avatar: 'https://picsum.photos/id/1012/200/200',
    role: 'Líder Móvil',
    company: 'StartupX',
    status: 'Responded',
    aiAnalysis: 'Ex-Google. Mantiene paquetes populares de Dart.',
    matchScore: 94,
    skills: ['Flutter', 'Kotlin', 'Diseño de Sistemas'],
    location: 'Remoto (US)',
    experience: '8 Años',
    education: 'Máster Ing. Software, MIT'
  },
  {
    id: '3',
    name: 'Sarah Connor',
    avatar: 'https://picsum.photos/id/1027/200/200',
    role: 'Ingeniera Full Stack',
    company: 'Skynet Systems',
    status: 'Contacted',
    aiAnalysis: 'Gran ojo para UI/UX. Transición desde React Native.',
    matchScore: 82,
    skills: ['React Native', 'TypeScript', 'Node.js'],
    location: 'Londres, UK',
    experience: '4 Años',
    education: 'Autodidacta'
  },
  {
    id: '4',
    name: 'Marcos Johnson',
    avatar: 'https://picsum.photos/id/1005/200/200',
    role: 'Arquitecto Flutter',
    company: 'Global Stream',
    status: 'Responded',
    aiAnalysis: 'Experto en patrón Bloc. 7 años de exp. móvil.',
    matchScore: 89,
    skills: ['Flutter', 'Bloc', 'Clean Architecture'],
    location: 'Berlín, DE',
    experience: '7 Años',
    education: 'Grado Ciencias Comp.'
  },
  {
    id: '5',
    name: 'Priya Patel',
    avatar: 'https://picsum.photos/id/1013/200/200',
    role: 'Desarrolladora de Apps',
    company: 'Freelance',
    status: 'Contacted',
    aiAnalysis: 'Alta velocidad de entrega. Buen ajuste para sprints rápidos.',
    matchScore: 78,
    skills: ['Flutter', 'Diseño UI', 'Figma'],
    location: 'Mumbai, IN',
    experience: '3 Años',
    education: 'Grado en Diseño Interactivo'
  },
  {
    id: '6',
    name: 'Alex Dummy',
    avatar: 'https://picsum.photos/id/1025/200/200',
    role: 'Backend Golang',
    company: 'Cloud Corp',
    status: 'Pool',
    aiAnalysis: 'Experiencia en computación de alto rendimiento.',
    matchScore: 65,
    skills: ['Go', 'Kubernetes', 'AWS'],
    location: 'Toronto, CA',
    experience: '5 Años',
    education: 'Ingeniería de Sistemas'
  },
   {
    id: '7',
    name: 'Martha Kent',
    avatar: 'https://picsum.photos/id/1024/200/200',
    role: 'Diseñadora de Producto',
    company: 'Daily Planet',
    status: 'Pool',
    aiAnalysis: 'Portafolio premiado.',
    matchScore: 88,
    skills: ['Figma', 'Prototypado', 'User Research'],
    location: 'Metropolis, USA',
    experience: '5 Años',
    education: 'Máster en Diseño'
  },
];