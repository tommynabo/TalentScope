/**
 * Message Generator for LinkedIn Outreach
 * Generates personalized icebreaker messages based on selected user (Mauro or Nyo)
 */

export type OutreachUser = 'mauro' | 'nyo' | 'miguel' | 'liam' | 'josue';

export interface OutreachMessages {
  icebreaker: string;
  followup_message: string;
  second_followup: string;
}

/**
 * Generates outreach messages based on selected user
 * Replaces {{nombre}} with candidate name and {{stack}} with their specialty
 */
export function generateOutreachMessages(
  candidateName: string,
  candidateSpecialty: string,
  selectedUser: OutreachUser,
  aiMessages?: Partial<OutreachMessages>
): OutreachMessages {
  const specialty = candidateSpecialty || 'tecnología';
  const name = candidateName || 'Colega';

  // Template messages by user
  const templates = {
    mauro: {
      icebreaker: `Hola ${name} — soy Mauro, fundador de Symmetry (una app de fitness con fuerte crecimiento) y vi tu experiencia como ${specialty}. Me gustaría conectar.`,
      followup: `${name}, tras revisar tu perfil sabemos que eres el perfil ideal. ¿Podríamos agendar una llamada?`,
      second: `${name}, viendo tu trayectoria creemos que hay una gran alineación. Te compartimos una oportunidad que podría ser perfect fit para ti.`
    },
    nyo: {
      icebreaker: `Hola ${name} — soy Nyo, recruiter de Symmetry (una app de fitness con fuerte crecimiento) y vi tu experiencia como ${specialty}. Me gustaría conectar.`,
      followup: `${name}, tras revisar tu perfil sabemos que eres el perfil ideal. ¿Podríamos agendar una llamada?`,
      second: `${name}, viendo tu trayectoria creemos que hay una gran alineación. Te compartimos una oportunidad que podría ser perfect fit para ti.`
    },
    miguel: {
      icebreaker: `Hola ${name} — soy Miguel, fundador de Symmetry (una app de fitness con fuerte crecimiento) y vi tu experiencia como ${specialty}. Me gustaría conectar.`,
      followup: `${name}, tras revisar tu perfil sabemos que eres el perfil ideal. ¿Podríamos agendar una llamada?`,
      second: `${name}, viendo tu trayectoria creemos que hay una gran alineación. Te compartimos una oportunidad que podría ser perfect fit para ti.`
    },
    liam: {
      icebreaker: `Hola ${name} — soy Liam, recruiter de Symmetry (una app de fitness con fuerte crecimiento) y vi tu experiencia como ${specialty}. Me gustaría conectar.`,
      followup: `${name}, tras revisar tu perfil sabemos que eres el perfil ideal. ¿Podríamos agendar una llamada?`,
      second: `${name}, viendo tu trayectoria creemos que hay una gran alineación. Te compartimos una oportunidad que podría ser perfect fit para ti.`
    },
    josue: {
      icebreaker: `Hola ${name} — soy Josue, recruiter de Symmetry (una app de fitness con fuerte crecimiento) y vi tu experiencia como ${specialty}. Me gustaría conectar.`,
      followup: `${name}, tras revisar tu perfil sabemos que eres el perfil ideal. ¿Podríamos agendar una llamada?`,
      second: `${name}, viendo tu trayectoria creemos que hay una gran alineación. Te compartimos una oportunidad que podría ser perfect fit para ti.`
    }
  };

  const t = templates[selectedUser];

  return {
    icebreaker: t.icebreaker,
    followup_message: t.followup,
    second_followup: t.second
  };
}

/**
 * Extract specialty/skills from candidate profile
 * Returns the primary skill or specialty
 */
export function extractSpecialty(
  jobTitle?: string,
  skills?: string[],
  aiAnalysis?: any
): string {
  // Try to get from skills first
  if (skills && skills.length > 0) {
    return skills[0];
  }

  // Try to extract from job title
  if (jobTitle) {
    const titleLower = jobTitle.toLowerCase();
    if (titleLower.includes('frontend')) return 'Frontend';
    if (titleLower.includes('backend')) return 'Backend';
    if (titleLower.includes('fullstack')) return 'Fullstack';
    if (titleLower.includes('devops')) return 'DevOps';
    if (titleLower.includes('mobile')) return 'Mobile';
    if (titleLower.includes('react')) return 'React';
    if (titleLower.includes('node')) return 'Node.js';
    if (titleLower.includes('python')) return 'Python';
    if (titleLower.includes('data')) return 'Data Science';
    if (titleLower.includes('engineer')) return 'Software Engineering';
    
    // Generic specialty from job title
    return jobTitle;
  }

  // Default fallback
  return 'tecnología';
}
