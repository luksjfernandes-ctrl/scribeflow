import { Doc, Project, DocumentMetadata } from './types';

export const FOLDER_COLORS = {
  'manuscript': '#E8C94A', // Amarelo dourado
  'characters': '#5B8DEF', // Azul
  'places':     '#E07830', // Laranja  
  'research':   '#9B59B6', // Roxo
  'notes':      '#5BAA3D', // Verde
  'front-matter': '#AAA',  // Cinza
  'trash':      '#888',    // Cinza escuro
};

export const ICONS = {
  folder: (color = FOLDER_COLORS.manuscript) => `
    <svg width="16" height="14" viewBox="0 0 16 14" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 2.5C1 1.67 1.67 1 2.5 1H6l1.5 1.5H13.5C14.33 2.5 15 3.17 15 4V11.5C15 12.33 14.33 13 13.5 13H2.5C1.67 13 1 12.33 1 11.5V2.5Z" 
        fill="${color}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>
      <path d="M1 4.5H15V11.5C15 12.33 14.33 13 13.5 13H2.5C1.67 13 1 12.33 1 11.5V4.5Z" 
        fill="rgba(255,255,255,0.15)" stroke="rgba(0,0,0,0.1)" stroke-width="0.5"/>
    </svg>
  `,
  textDoc: (hasContent = true) => `
    <svg width="14" height="16" viewBox="0 0 14 16" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 1.5C1.5 0.95 1.95 0.5 2.5 0.5H9L12.5 4V14.5C12.5 15.05 12.05 15.5 11.5 15.5H2.5C1.95 15.5 1.5 15.05 1.5 14.5V1.5Z" 
        fill="white" stroke="#B0ADA5" stroke-width="0.6"/>
      <path d="M9 0.5V3.5C9 3.78 9.22 4 9.5 4H12.5" 
        fill="none" stroke="#B0ADA5" stroke-width="0.6"/>
      ${hasContent ? `
      <line x1="3.5" y1="6" x2="10.5" y2="6" stroke="#D0CEC8" stroke-width="0.5"/>
      <line x1="3.5" y1="8" x2="10.5" y2="8" stroke="#D0CEC8" stroke-width="0.5"/>
      <line x1="3.5" y1="10" x2="8" y2="10" stroke="#D0CEC8" stroke-width="0.5"/>
      ` : ''}
    </svg>
  `,
  research: `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="7" r="4.5" stroke="#5A5A5A" stroke-width="1.2"/>
      <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="#5A5A5A" stroke-width="1.2" stroke-linecap="round"/>
    </svg>
  `,
  characters: `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="6" r="3" stroke="#5A5A5A" stroke-width="1.2"/>
      <path d="M4 13c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="#5A5A5A" stroke-width="1.2" stroke-linecap="round"/>
    </svg>
  `,
  places: `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2c-2.2 0-4 1.8-4 4 0 3 4 8 4 8s4-5 4-8c0-2.2-1.8-4-4-4z" stroke="#5A5A5A" stroke-width="1.2"/>
      <circle cx="8" cy="6" r="1.2" fill="#5A5A5A"/>
    </svg>
  `,
  trash: `
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 4h8l-.5 8.5c0 .55-.45 1-1 1H4.5c-.55 0-1-.45-1-1L3 4z" stroke="#5A5A5A" stroke-width="1"/>
      <rect x="2" y="2.5" width="10" height="1.5" rx="0.5" stroke="#5A5A5A" stroke-width="1"/>
      <rect x="5" y="1" width="4" height="2" rx="0.5" stroke="#5A5A5A" stroke-width="1"/>
    </svg>
  `,
  disclosure: `
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 1.5L5.5 4L2 6.5V1.5Z" fill="#7A7770"/>
    </svg>
  `,
  disclosureExpanded: `
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 2.5L4 6L6.5 2.5H1.5Z" fill="#7A7770"/>
    </svg>
  `
};

export const LABEL_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  'none':    { bg: 'transparent', border: '#CCC',    dot: '#CCC' },
  'red':     { bg: '#FDEAEA',     border: '#E8A0A0', dot: '#E05050' },
  'orange':  { bg: '#FDF0EA',     border: '#E8C0A0', dot: '#E08030' },
  'yellow':  { bg: '#FDFAEA',     border: '#E8D8A0', dot: '#D0B020' },
  'green':   { bg: '#EAFDE8',     border: '#A0E8A0', dot: '#40A040' },
  'blue':    { bg: '#EAF0FD',     border: '#A0B8E8', dot: '#4070D0' },
  'purple':  { bg: '#F4EAFD',     border: '#C0A0E8', dot: '#8040D0' },
};

export const INITIAL_PROJECT: Project = {
  id: 'project-1',
  name: "The Brothers Karamazov",
  owner_id: 'user-1',
  created_at: Date.now(),
  updated_at: Date.now(),
  settings: {
    target_word_count: 80000,
    session_target: 2000,
    deadline: null,
    composition_theme: 'sepia',
    theme: 'traditional',
    paper_width: 700,
    background_opacity: 0.8,
  },
};

const createMetadata = (overrides: Partial<DocumentMetadata> = {}): DocumentMetadata => ({
  status: 'To Do',
  label: 'none',
  label_color: 'transparent',
  synopsis: '',
  notes: '',
  target_word_count: 0,
  is_include_in_compile: true,
  section_type: 'Scene',
  created_at: Date.now(),
  updated_at: Date.now(),
  keywords: [],
  custom_metadata: {},
  snapshots: [],
  comments: [],
  bookmarks: [],
  ...overrides,
});

export const INITIAL_DOCS: Doc[] = [
  {
    id: 'manuscript',
    title: 'Manuscript',
    content: '',
    type: 'folder',
    parent_id: null,
    order: 0,
    is_expanded: true,
    metadata: createMetadata({ section_type: 'Heading' }),
  },
  {
    id: 'ch1',
    title: 'Meeting at Orson Lake',
    type: 'text',
    parent_id: 'manuscript',
    order: 0,
    content: `
      <h1>The Meeting at Orson Lake</h1>
      <blockquote>
        <em>So lamas epp teng galph obrikt park wynlance re prinquil epp er sorl ma.<br>
        Crve me nalista, dwint furng er tolapsa.</em><br>
        <span style="font-size:12px;color:#777;">—Helk Srung</span>
      </blockquote>
      <p>Jince gra la tharn lamas ewayf wynlance. Gronk ju sorl quilt galph grounm merandis tham epp nalista whik re park yem jince gra sorl urfa nalista. Kumrap srung twork srung dri merandis ma park ewayf re srung ma, nix velar grounm berot clum.</p>
      <p>Twork srung tolapsa, urfa athran park prinquil er si shull film shull twork relwag, twork, gra frimba vusp. Yem park lydran berot ju, galph vo brul re er nix su obrikt epp aru grel.</p>
      <p>"Lydran tolapsa fi, twork furng, delm su grounm relwag jince re, tharn fi grounm tolapsa us."</p>
      <p>"Epp, ma nalista oullnt, irpsa erk," athran tolapsa twork fli semag shull. "Welar prinquils dwint su grounm korsa ma si sorl erk lamas nalista."</p>
      <p>"Ux wynlance lydran wex ju whik srung, enulj ju galph, wex enulj korsa rintax park su ti, urfa sorl su jo. Xi velar si relwag, grounm park su thung, gronk grounm crve erk."</p>
    `,
    metadata: createMetadata({
      synopsis: 'The family gathers at Orson Lake. First encounter between protagonist and antagonist.',
      label: 'green',
      status: 'First Draft',
      notes: 'Need to add more sensory details about the lake setting.'
    })
  },
  {
    id: 'ch2',
    title: 'The Silent Witness',
    type: 'text',
    parent_id: 'manuscript',
    order: 1,
    content: '<h2>Chapter 2</h2><p>The morning mist clung to the water like a shroud...</p>',
    metadata: createMetadata({
      synopsis: 'A mysterious figure watches from the shadows.',
      label: 'blue',
      status: 'In Progress',
    })
  },
  {
    id: 'characters',
    title: 'Characters',
    content: '',
    type: 'folder',
    parent_id: null,
    order: 1,
    is_expanded: true,
    metadata: createMetadata({ is_include_in_compile: false }),
  },
  {
    id: 'char1',
    title: 'Protagonist',
    type: 'text',
    parent_id: 'characters',
    order: 0,
    content: '<h1>Protagonist Profile</h1><p>Name: Elara Vance</p>',
    metadata: createMetadata({
      synopsis: 'Main character details.',
      label: 'none',
      status: 'none',
    })
  },
  {
    id: 'places',
    title: 'Places',
    content: '',
    type: 'folder',
    parent_id: null,
    order: 2,
    metadata: createMetadata({ is_include_in_compile: false }),
  },
  {
    id: 'research',
    title: 'Research',
    content: '',
    type: 'folder',
    parent_id: null,
    order: 3,
    metadata: createMetadata({ is_include_in_compile: false }),
  },
  {
    id: 'trash',
    title: 'Trash',
    content: '',
    type: 'trash',
    parent_id: null,
    order: 4,
    metadata: createMetadata({ is_include_in_compile: false }),
  },
];
