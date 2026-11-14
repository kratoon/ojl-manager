// The single source of all UI labels. Components must not contain literal text:
// add a key here (in every locale) and read it through useT().

const cs = {
  app: {
    title: 'OJL Manager',
  },
  nav: {
    setup: 'Nastavení',
    employees: 'Zaměstnanci',
  },
  employees: {
    title: 'Zaměstnanci',
    empty: 'Zatím zde nejsou žádní zaměstnanci.',
    firstName: 'Jméno',
    lastName: 'Příjmení',
    add: 'Přidat zaměstnance',
    createTitle: 'Nový zaměstnanec',
    editTitle: 'Upravit zaměstnance',
    backToList: '← Zpět na zaměstnance',
    notFound: 'Zaměstnanec nebyl nalezen.',
    deleteConfirm: 'Opravdu chcete smazat tohoto zaměstnance?',
    loadError: 'Zaměstnance se nepodařilo načíst.',
    saveError: 'Zaměstnance se nepodařilo uložit. Zkontrolujte údaje.',
  },
  common: {
    loading: 'Načítání…',
    save: 'Uložit',
    cancel: 'Zrušit',
    edit: 'Upravit',
    delete: 'Smazat',
    actions: 'Akce',
    close: 'Zavřít',
    noAccess: 'Nemáte oprávnění zobrazit tuto stránku.',
  },
  home: {
    welcome: 'Vítejte v aplikaci OJL Manager.',
  },
};

export type Labels = typeof cs;

const en: Labels = {
  app: {
    title: 'OJL Manager',
  },
  nav: {
    setup: 'Setup',
    employees: 'Employees',
  },
  employees: {
    title: 'Employees',
    empty: 'There are no employees yet.',
    firstName: 'First name',
    lastName: 'Last name',
    add: 'Add employee',
    createTitle: 'New employee',
    editTitle: 'Edit employee',
    backToList: '← Back to employees',
    notFound: 'Employee not found.',
    deleteConfirm: 'Are you sure you want to delete this employee?',
    loadError: 'Could not load employees.',
    saveError: 'Could not save the employee. Check the values.',
  },
  common: {
    loading: 'Loading…',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    actions: 'Actions',
    close: 'Close',
    noAccess: 'You do not have permission to view this page.',
  },
  home: {
    welcome: 'Welcome to OJL Manager.',
  },
};

export const labels = { cs, en } satisfies Record<string, Labels>;

export type Locale = keyof typeof labels;

export const defaultLocale: Locale = 'cs';
