/* The single Dutch string dictionary (spec: "v1 is Nederlands-only → één nl.ts").
 *
 * Fixed vocabulary — never synonymised (spec "Niet-functionele requirements"):
 *   Taak / Taken · Project · Sjabloon · Kenmerk · Status · Herinnering · Keuzelijst
 * Never "todo", "template", "attribuut", "reminder", "tag".
 *
 * Sentence case everywhere; only the 11px section labels are uppercase.
 */
export const nl = {
  app: {
    name: "Segment",
    trayNotice: "Draait op de achtergrond. Herinneringen komen door.",
    // "Warn, don't scold" — het venster sluiten stopt de app niet, en het
    // gevolg van autostart-uit staat er rustig bij.
    trayNoticeTooltip:
      "Het venster sluiten stopt de app niet: deze draait door in de achtergrond en herinneringen blijven binnenkomen. Afsluiten doe je met de rechtermuisknop op het icoontje. De app start niet vanzelf met Windows mee. Is de app helemaal afgesloten, dan verschijnen gemiste herinneringen bij de volgende start op het dashboard.",
  },

  nav: {
    groupOverview: "Overzicht",
    groupManage: "Beheer",
    dashboard: "Dashboard",
    tasks: "Taken",
    projects: "Projecten",
    templates: "Sjablonen",
    attributes: "Kenmerken",
    statuses: "Statussen",
  },

  // Sub-views of Taken. Kalender is a view here, never a sidebar destination.
  taskViews: {
    list: "Lijst",
    table: "Tabel",
    kanban: "Bord",
    calendar: "Kalender",
  },

  // Default statuses seeded on first start (spec §5, §11).
  status: {
    todo: "Te doen",
    busy: "Bezig",
    done: "Klaar",
  },

  common: {
    loading: "Bezig met laden…",
    nothingYet: "Nog niets",
    search: "Zoeken…",
  },

  // Placeholder empty states.
  placeholder: {
    dashboard: "Het dashboard verschijnt hier zodra er taken en herinneringen zijn.",
    tasks: "Nog geen taken. Voeg een taak toe om te beginnen.",
    projects: "Nog geen projecten. Maak een project aan om taken te groeperen.",
    templates:
      "Nog geen sjablonen. Een sjabloon legt de vaste stappen van een projecttype vast.",
    attributes:
      "Nog geen kenmerken. Een kenmerk is een extra veld dat je aan taken hangt.",
    statuses: "De statussen Te doen, Bezig en Klaar staan klaar.",
  },

  // Shared footer bar on every task view (readme: same wording everywhere).
  footer: {
    visible: (shown: number, total: number) => `${shown} van ${total} taken zichtbaar`,
    late: (n: number) => `${n} te laat`,
    clearFilterSort: "Filter en sortering wissen",
  },

  // Takenviews — de gedeelde filter, het paneel, de views (spec §8).
  views: {
    searchPlaceholder: "Zoek op titel, omschrijving of project…",
    emptyFiltered: "Geen taken in deze selectie.",

    // view-chrome (kop tweede rij: tabs + filter/sortering/groepering)
    visibleShort: (shown: number, total: number) => `${shown} van ${total} zichtbaar`,
    sortLabel: "Sorteren",
    sortByStep: "Stap",

    // filterpaneel
    filterTitle: "Filter",
    filterClearAll: "Alles wissen",
    filterGroupStatus: "Status",
    filterGroupDeadline: "Deadline",
    filterGroupProject: "Project",
    filterGroupGlobalAttrs: "Algemene kenmerken",
    filterGroupProjectAttrs: "Projectkenmerken",
    filterNoProjects: "Nog geen projecten om op te filteren.",
    filterNotFilledIn: "Niet ingevuld",
    filterFilledIn: "Ingevuld",
    filterChecked: "Aangevinkt",
    filterUnchecked: "Niet aangevinkt",
    deadlineOverdue: "Verlopen",
    deadlineToday: "Vandaag",
    deadlineThisWeek: "Deze week",
    deadlineNone: "Geen deadline",
    deadlineRange: "Bereik",
    deadlineRangeFrom: "Van",
    deadlineRangeTo: "Tot",

    // lijst
    groupBy: "Groeperen",
    groupByProject: "Per project",
    groupByStatus: "Per status",
    groupByNone: "Geen groepering",
    groupProgress: (done: number, total: number) => `${done} van ${total} klaar`,
    groupCount: (n: number) => (n === 1 ? "1 taak" : `${n} taken`),
    selectTask: "Taak selecteren",

    // kanban
    sortByTitle: "Titel",
    sortByDeadline: "Deadline",
    sortByCreated: "Aangemaakt",
    addTaskInStatus: (status: string) => `Taak toevoegen in ${status}`,

    // tabel
    columns: "Kolommen",
    moveUp: "Naar boven",
    moveDown: "Naar onder",
    colTitle: "Titel",
    colProject: "Project",
    colStatus: "Status",
    colDeadline: "Deadline",
    colCreated: "Aangemaakt",

    // bulkbalk — korte varianten onder krappe breedte
    bulkSelectedShort: (n: number) => `${n} geselecteerd`,
    bulkStatus: "Status wijzigen",
    bulkStatusShort: "Status",
    bulkDeadline: "Deadline wijzigen",
    bulkDeadlineShort: "Deadline",
    bulkDeadlineClear: "Deadline wissen",
    bulkClear: "Selectie wissen",
    bulkClearShort: "Wissen",
  },

  // Dashboard — late-banner + de drie blokken (spec §7).
  dashboard: {
    title: "Dashboard",
    toAllTasks: "Naar alle taken",
    newTask: "Nieuwe taak",
    bannerLate: (n: number, since: string) =>
      `${n} ${n === 1 ? "herinnering kon niet gestuurd worden" : "herinneringen konden niet gestuurd worden"} — de app stond niet open sinds ${since}.`,
    bannerMarkSeen: "Markeer als gezien",
    nothingLateTitle: "Niets te laat",
    nothingLateBody: (since: string) =>
      `Alle herinneringen sinds ${since} zijn verstuurd.`,
    sectionReminders: "Herinneringen",
    sectionDeadlines: "Deadlines",
    sectionProjects: "Actieve projecten",
    seeAll: "Alles bekijken",
    toProjects: "Naar projecten",
    markRowSeen: "Deze herinnering als gezien markeren",
    noReminders: "Geen herinneringen — die komen uit de taken van een project.",
    noDeadlines: "Geen deadlines.",
    noProjects: "Nog geen projecten.",
    chipLate: (when: string) => `Laat · ${when}`,
    chipToday: (time: string) => (time ? `Vandaag ${time}` : "Vandaag"),
    daysLate: (n: number) =>
      n <= 0 ? "Te laat" : n === 1 ? "1 dag te laat" : `${n} dagen te laat`,
    activeCount: (active: number, total: number) => `${active} van ${total}`,
    looseNote: (n: number) => (n === 1 ? "1 losse taak" : `${n} losse taken`),
    activeExplainer:
      "Een project blijft actief zolang één taak niet op de afgerond-status staat.",
    looseTaskLabel: "Losse taak",
    step: (pos: number, total: number) => `stap ${pos} van ${total}`,
  },

  // Kalender — alleen-lezen maand/week (spec §8).
  calendar: {
    month: "Maand",
    week: "Week",
    today: "Vandaag",
    back: "Vorige",
    next: "Volgende",
    legendDeadline: "Deadline",
    legendReminder: "Herinnering",
    legendLate: "Te laat",
    readOnlyNote: "Kalender is alleen-lezen — wijzig een deadline in de taak zelf.",
    openTask: "Open taak",
    allDay: "Hele dag",
    dayItems: (n: number) => (n === 1 ? "1 item" : `${n} items`),
    moreEvents: (n: number) => `nog ${n}`,
    empty: "Geen deadlines of herinneringen in deze periode.",
  },

  // Lege toestanden / onboarding (spec §11).
  onboarding: {
    step: (n: number) => `Stap ${n} van 3`,
    optional: "Optioneel",
    templates: {
      title: "Nog geen sjablonen",
      body: "Een sjabloon beschrijft één type project als een vaste reeks taken. Je maakt het één keer en start er daarna projecten uit.",
      action: "Sjabloon maken",
      hint: "Begin met het type project dat je het vaakst doet.",
    },
    projects: {
      title: "Nog geen projecten",
      body: "Een project is een groepering, de taken van een sjabloon met echte deadlines erop. Het sjabloon blijft ongewijzigd.",
      action: "Project starten",
      hint: "Nog geen sjabloon? Maak er eerst één.",
    },
    tasks: {
      title: "Nog geen taken",
      body: "Taken komen mee met een project dat je uit een sjabloon start. Losse taken kan je hier ook zelf toevoegen.",
      action: "Taak toevoegen",
      hint: "Of start eerst een project — dan staan alle stappen er meteen in.",
    },
    attributes: {
      title: "Nog geen kenmerken",
      body: "Kenmerken zijn de velden die je per taak invult, zoals type, prioriteit of verantwoordelijke. Ze worden kolommen in de tabelweergave en filters in elke view.",
      action: "Kenmerk toevoegen",
      hint: "Er zijn verschillende types kenmerken: tekst, getal, datum, keuzelijst of checkbox.",
    },
    dashboard: {
      title: "Nog niets gepland",
      lead: "Zo begin je",
      body: "Start met een sjabloon van het type project dat je het vaakst doet. Start er een project uit en volg de taken op het dashboard.",
      step1Title: "Maak een sjabloon",
      step1Body:
        "Werk één type project uit: de taken in volgorde, met hun herinneringen.",
      step1Action: "Sjabloon maken",
      step2Title: "Start een project",
      step2Body:
        "Het sjabloon wordt gekopieerd naar een project. Taken en herinneringen worden automatisch aangemaakt.",
      step2Action: "Project starten",
      step3Title: "Volg de taken op",
      step3Body:
        "Wat vandaag moet gebeuren of te laat is, komt bovenaan dit dashboard te staan.",
      step3Action: "Naar taken",
      optionalAttrTitle: "Kenmerken toevoegen",
      optionalAttrBody:
        "Eigen velden bij taken en projecten — datums, keuzelijsten, checkboxen. Je kan er later op filteren.",
      optionalAttrAction: "Kenmerken bekijken",
      optionalStatusTitle: "Statussen aanpassen",
      optionalStatusBody:
        "Te doen, bezig en klaar zijn reeds aangemaakt. Je kan eigen statussen toevoegen — die worden de kolommen op het bord.",
      optionalStatusAction: "Statussen bekijken",
    },
  },

  // Eigen in-app update-modal (spec "Auto-update"). "Warn, don't scold".
  update: {
    title: (version: string) => `Versie ${version} is beschikbaar`,
    body: "Er staat een nieuwe versie klaar. Werk nu bij voor de nieuwste functionaliteiten.",
    notesLabel: "Wat is nieuw",
    confirm: "Nu bijwerken",
    later: "Later",
    working: "Bezig met bijwerken…",
    failed: "De update kon niet worden geïnstalleerd. Probeer het later opnieuw.",
  },

  error: {
    migrationFailed:
      "De database kon niet worden bijgewerkt. Start de app opnieuw; blijft dit fout gaan, neem dan contact op met de beheerder.",
    generic: "Er ging iets mis.",
  },

  // Shared across the three beheerpagina's.
  beheer: {
    dragToReorder: "Sleep om te herschikken",
    cancel: "Annuleren",
    save: "Bewaren",
    add: "Toevoegen",
    delete: "Verwijderen",
    close: "Sluiten",
    edit: "Bewerken",
    duplicate: "Dupliceren",
    name: "Naam",
    loading: "Bezig met laden…",
    loadError: "Kon de gegevens niet laden.",
    usedBy: "Gebruikt door",
    nothing: "Nog niets",
  },

  statuses: {
    title: "Statussen",
    count: (n: number) => (n === 1 ? "1 status" : `${n} statussen`),
    newStatus: "Nieuwe status",
    intro:
      "Statussen gelden voor alle taken en projecten. De volgorde hieronder reflecteert de volgorde waarin je taken normaal uitvoert. Het bepaalt ook de volgorde van de kolommen in de bord-weergave.",
    orderLabel: "Volgorde",
    remindersFire: "Herinneringen worden gestuurd",
    remindersStop: "Herinneringen worden niet meer gestuurd",
    defaultBadge: "Standaard voor nieuwe taken",
    doneBadge: "Afgerond-status",
    colorLabel: "Kleur",
    colorHelp: "De kleur is enkel visueel.",
    roleLabel: "Rol",
    defaultRoleNote:
      "Dit is de standaardstatus: elke nieuwe taak start hier, ook taken uit een sjabloon. Deze rol ligt vast — je kunt de status alleen hernoemen.",
    doneRoleNote:
      "Dit is de afgerond-status: taken hierin tellen niet meer mee in de deadlines op het dashboard en er worden geen herinneringen meer voor gestuurd. Deze rol ligt vast — je kunt de status alleen hernoemen.",
    positionLabel: "Plaats in de reeks",
    deleteStatus: "Status verwijderen",
    panelPlace: (pos: number, total: number) => `Status · plaats ${pos} van ${total}`,
    todoCount: (n: number) => (n === 1 ? "1 taak" : `${n} taken`),
    usedByReminders: "Gebruikt door herinneringen",
    // dialogs
    deleteTitle: (name: string) => `${name} verwijderen`,
    deleteBodyNoTasks: (name: string) =>
      `${name} verdwijnt uit elke keuzelijst en uit de bord-weergave. Dit kan niet teruggedraaid worden.`,
    deleteBodyWithTasks: (n: number) =>
      `${n} taken staan op deze status. Kies eerst waar die naartoe gaan — daarna verdwijnt de status uit elke keuzelijst en uit de bord-weergave.`,
    reassignLabel: (n: number) => `De ${n} taken verplaatsen naar`,
    reassignReminderNote:
      "Status-gebaseerde herinneringen die vanaf deze status rekenden, gaan mee en worden opnieuw berekend.",
    deleteVerbNoTasks: "Verwijderen",
    deleteVerbWithTasks: "Verplaatsen en verwijderen",
    irreversible: "Verwijderen kan niet teruggedraaid worden.",
    emptyList: "De statussen Te doen, Bezig en Klaar staan klaar.",
  },

  attributes: {
    title: "Kenmerken",
    count: (n: number) => (n === 1 ? "1 kenmerk" : `${n} kenmerken`),
    newAttribute: "Nieuw kenmerk",
    intro:
      "Kenmerken zijn de velden die per taak ingevuld worden. Een algemeen kenmerk kan bij elke taak gebruikt worden. Een projectkenmerk hoort bij één sjabloon en werkt enkel bij taken gekoppeld aan dat sjabloon.",
    groupGlobal: "Algemeen",
    groupGlobalHint: "Bruikbaar bij elke taak",
    groupProject: "Per sjabloon",
    groupProjectHint: "Enkel bij taken uit projecten van dat sjabloon",
    typeLabel: "Type",
    types: {
      text: "Tekst",
      number: "Getal",
      date: "Datum",
      select: "Keuzelijst",
      checkbox: "Checkbox",
    },
    typeHints: {
      text: "Vrije tekst",
      number: "Met eenheid",
      date: "Dag, tijd optioneel",
      select: "Vaste opties",
      checkbox: "Aan of leeg",
    },
    typeReadonly: "Het type staat vast na aanmaken.",
    newHelp:
      "Een kenmerk is een veld dat per taak ingevuld wordt. Het type bepaalt hoe het ingevuld wordt en kan later niet meer wijzigen.",
    globalNote:
      "Dit kenmerk is algemeen: bruikbaar bij elke taak, ook bij losse taken. Een kenmerk voor een sjabloon voeg je toe bij dat sjabloon zelf.",
    appearsEmpty: "Komt bij alle bestaande taken als leeg veld.",
    // text
    lengthLabel: "Lengte",
    lengthSingle: "Één lijn",
    lengthMulti: "Meerdere lijnen",
    lengthHelp:
      "Één lijn past in de tabelweergave; meerdere lijnen enkel bij de taakdetails.",
    // number
    unitLabel: "Eenheid",
    unitOptional: "Optioneel",
    unitPlaceholder: "bv. u, km, €",
    unitHelp: "De eenheid staat achter het getal en wordt niet meegetypt.",
    previewLabel: "Voorbeeld",
    // date
    dateNothing: "Niets in te stellen",
    dateHelp:
      "Een datum kan een uur bevatten. Bij het invullen op een taak laat je het uur leeg of vul je het aan.",
    // checkbox
    checkboxLabel: "Bij een nieuwe taak",
    checkboxEmpty: "Leeg",
    checkboxChecked: "Aangevinkt",
    checkboxHelp: "Aangevinkt telt als 'Ja', leeg als 'Nee'.",
    // select
    selectionLabel: "Selectie",
    selectionSingle: "Enkelvoudig",
    selectionMultiple: "Meervoudig",
    optionsLabel: "Opties",
    addOption: "+ Optie",
    optionCount: (n: number) => (n === 1 ? "1 optie" : `${n} opties`),
    // detail
    scopeLabel: "Bereik",
    scopeGlobal: "Algemeen",
    scopeProject: "Per sjabloon",
    settingLabel: "Instelling",
    usedInLabel: "Gebruikt in",
    valueCount: (n: number) =>
      n === 1 ? "Ingevuld bij 1 taak" : `Ingevuld bij ${n} taken`,
    deleteAttribute: "Kenmerk verwijderen",
    summary: (opts: string) => opts,
    optionSummary: (multiple: boolean, n: number) =>
      `Keuzelijst · ${multiple ? "meervoudig" : "enkelvoudig"} · ${
        n === 1 ? "1 optie" : `${n} opties`
      }`,
    // dialogs
    renameOptionTitle: "Optie hernoemen",
    renameOptionBody: (from: string, to: string, attr: string, n: number) =>
      `De optie ${from} van het kenmerk ${attr} wordt ${to}. ${n} ${
        n === 1 ? "taak verwijst" : "taken verwijzen"
      } vandaag naar deze optie.`,
    renameApplyLabel: "Wat met de bestaande taken",
    renameApplyYes: (n: number) => `Ook bij de ${n} taken hernoemen`,
    renameApplyYesHelp: (to: string) => `Bij die taken lees je vanaf nu ${to}.`,
    renameApplyNo: (from: string) => `Bestaande taken op ${from} laten staan`,
    renameApplyNoHelp:
      "De oude naam blijft bij die taken bewaard; de nieuwe naam geldt enkel bij taken die je hierna aanmaakt.",
    renameVerb: "Hernoemen",
    deleteOptionTitle: "Optie verwijderen",
    deleteOptionBody: (label: string, attr: string, n: number) =>
      `De optie ${label} van het kenmerk ${attr} wordt verwijderd. ${n} ${
        n === 1 ? "taak verwijst" : "taken verwijzen"
      } er naar.`,
    deleteOptionClearYes: (n: number) => `De waarde ook bij de ${n} taken verwijderen`,
    deleteOptionClearNo: "De waarde bij die taken laten staan",
    deleteOptionVerb: "Verwijderen",
    scopeSwitchTitle: (name: string) => `${name} algemeen maken`,
    scopeSwitchBody:
      "Dit staat als algemeen ingesteld. Het kenmerk is bruikbaar bij elke taak, ook bij losse taken en taken uit andere sjablonen. De bestaande waarden blijven staan.",
    scopeSwitchWarning:
      "Dit kan niet teruggedraaid worden: een algemeen kenmerk kan later niet meer naar een sjabloon overgezet worden.",
    scopeSwitchVerb: "Algemeen maken",
    deleteAttributeTitle: (name: string) => `${name} verwijderen`,
    deleteAttributeBody: (n: number) =>
      n === 0
        ? "Dit kenmerk wordt verwijderd. Er zijn nog geen taken met een waarde hiervoor."
        : `Verwijderen wist ook de waarde bij ${n} ${
            n === 1 ? "taak" : "taken"
          }. Dit kan niet teruggedraaid worden.`,
    emptyList:
      "Nog geen kenmerken. Een kenmerk is een extra veld dat je aan taken hangt.",
  },

  templates: {
    title: "Sjablonen",
    count: (n: number) => (n === 1 ? "1 sjabloon" : `${n} sjablonen`),
    newTemplate: "Nieuw sjabloon",
    intro: "Een sjabloon legt de vaste stappen van een projecttype vast.",
    nameLabel: "Naam",
    namePlaceholder: "bv. Intake",
    back: "Sjablonen",
    projectsUsing: (n: number) =>
      n === 0
        ? "nog niet gebruikt"
        : n === 1
          ? "gebruikt in 1 project"
          : `gebruikt in ${n} projecten`,
    taskCount: (n: number) => (n === 1 ? "1 taak" : `${n} taken`),
    changesNote:
      "Wijzigingen gelden enkel voor nieuwe projecten. Lopende projecten blijven zoals ze gestart zijn.",
    startProject: "Project starten",
    tasksInOrder: "Taken in volgorde",
    dropToSave: "Laat los om de nieuwe volgorde te bewaren",
    remindersFollowOrder: "Herinneringen volgen de nieuwe volgorde",
    addTask: "Taak toevoegen",
    addTaskHint: "Komt achteraan in de volgorde",
    taskTitleLabel: "Titel",
    taskDescriptionLabel: "Omschrijving",
    subEditorPlace: (pos: number, total: number) =>
      `Sjabloontaak · stap ${pos} van ${total}`,
    noDeadline:
      "Een sjabloontaak heeft geen eigen deadline of status. Die komen bij het starten van een project.",
    attributesLabel: "Kenmerken",
    attributesHint: "Deze zullen enkel zichtbaar zijn bij taken van dit sjabloon.",
    noOwnAttributes: "Nog geen eigen kenmerken.",
    addAttribute: "+ Kenmerk toevoegen",
    addAttributeValue: "+ Kenmerk",
    remindersLabel: "Herinneringen",
    addReminder: "+ Herinnering",
    perProject: "wordt automatisch berekend per project",
    leaveEmpty: "Leeg laten",
    deleteTemplateTitle: (name: string) => `${name} verwijderen`,
    deleteTemplateBody: (n: number) =>
      n === 0
        ? "Dit sjabloon en zijn sjabloontaken worden verwijderd. Er zijn geen projecten mee gestart."
        : `Dit sjabloon wordt verwijderd. De ${n} ${
            n === 1 ? "project dat" : "projecten die"
          } ermee gestart zijn, deze blijven bestaan maar verliezen de koppeling.`,
    copyTitle: (title: string) => `${title} (kopie)`,
    deleteTaskTitle: (title: string) => `${title} verwijderen`,
    deleteTaskBody:
      "Deze sjabloontaak wordt verwijderd, samen met haar kenmerken, links en herinneringen. De overige stappen schuiven op.",
    linksLabel: "Links",
    emptyList:
      "Nog geen sjablonen. Een sjabloon legt de vaste stappen van een projecttype vast.",
  },

  projects: {
    title: "Projecten",
    count: (n: number) => (n === 1 ? "1 project" : `${n} projecten`),
    newProject: "Nieuw project",
    intro:
      "Een project groepeert taken en zet ze in volgorde. Kies een sjabloon om met vaste stappen te starten, of begin leeg.",
    filterActive: "Actief",
    filterCompleted: "Afgerond",
    filterArchived: "Gearchiveerd",
    emptyActive:
      "Nog geen actieve projecten. Maak een project aan om taken te groeperen.",
    emptyFiltered: "Geen projecten in deze selectie.",
    progress: (done: number, total: number) => `${done}/${total} afgerond`,
    noTasks: "nog geen taken",
    stateActive: "Actief",
    stateCompleted: "Afgerond",
    stateArchived: "Gearchiveerd",
    fromTemplate: (name: string) => `uit sjabloon ${name}`,
    looseProject: "los project",
    openTasks: "Taken openen",
    back: "Projecten",
    // aanmaakdialoog
    createTitle: "Nieuw project",
    createFromLabel: "Starten met",
    createEmpty: "Leeg project",
    createTemplateLabel: "Sjabloon",
    createChooseTemplate: "Kies een sjabloon…",
    nameLabel: "Naam",
    namePlaceholder: "bv. Jan Peeters",
    colorLabel: "Kleur",
    // ···-menu
    menuRename: "Naam en kleur wijzigen",
    menuDuplicate: "Dupliceren",
    menuAddTask: "Taak toevoegen",
    menuMarkCompleted: "Als afgerond markeren",
    menuArchive: "Archiveren",
    menuUnarchive: "Terugzetten",
    menuDelete: "Project verwijderen",
    // dialogen
    renameTitle: "Naam en kleur wijzigen",
    duplicateTitle: (name: string) => `${name} dupliceren`,
    duplicateBody:
      "De kopie krijgt dezelfde taken, volgorde, links en kenmerken. Deadlines worden leeggemaakt. Alle taken worden teruggezet op de standaardstatus. Het nieuwe project start als actief.",
    duplicateVerb: "Dupliceren",
    markCompletedTitle: (name: string) => `${name} als afgerond markeren`,
    markCompletedBody:
      "Elke niet-afgeronde taak gaat naar de afgerond-status en doorloopt het normale afgerond-gedrag. Het project wordt afgerond.",
    markCompletedVerb: "Als afgerond markeren",
    archiveTitle: (name: string) => `${name} archiveren`,
    archiveBody:
      "Een gearchiveerd project verdwijnt uit de takenlijst en het dashboard, maar blijft doorzoekbaar. Openstaande herinneringen stoppen zolang het gearchiveerd is.",
    archiveOpenTasksWarning: (n: number) =>
      `Er ${n === 1 ? "staat nog 1 taak" : `staan nog ${n} taken`} open in dit project.`,
    archiveVerb: "Archiveren",
    unarchiveTitle: (name: string) => `${name} terugzetten`,
    unarchiveBody:
      "Het project keert terug naar actief of afgerond, afhankelijk van de taken. Status-gebaseerde herinneringen worden opnieuw berekend en kunnen daardoor als 'te laat' komen te staan.",
    unarchiveVerb: "Terugzetten",
    deleteTitle: (name: string) => `${name} verwijderen`,
    deleteBody:
      "Verwijderen wist het project met al zijn taken en herinneringen. Het sjabloon blijft bestaan. Dit kan niet teruggedraaid worden.",
    deleteTypeNameLabel: "Typ de projectnaam exact over om te bevestigen",
    deleteVerb: "Verwijderen",
    deleteArchiveInstead:
      "Liever archiveren? Sluit dit venster en kies Archiveren in het ···-menu.",
  },

  tasks: {
    title: "Taken",
    loose: "Losse taken",
    emptyList: "Nog geen taken. Voeg een taak toe om te beginnen.",
    open: "Openen",
    // snel toevoegen
    quickAddTitle: "Taak toevoegen",
    fullFormLink: "Alle velden…",
    titleLabel: "Titel",
    titlePlaceholder: "Wat moet er gebeuren?",
    descriptionLabel: "Omschrijving",
    projectLabel: "Project",
    noProject: "Losse taak, geen project",
    stepLabel: "Stap in het project",
    stepEnd: "Achteraan",
    stepCount: (pos: number, total: number) => `stap ${pos}/${total}`,
    statusLabel: "Status",
    markDone: "Markeer als klaar",
    deadlineLabel: "Deadline",
    deadlineDate: "Deadline",
    deadlineTime: "Tijdstip",
    deadlineTimeNone: "Geen tijdstip",
    deadlineNone: "Geen deadline",
    deadlineClear: "Wissen",
    remindersLabel: "Herinneringen",
    addReminder: "+ Herinnering",
    linksLabel: "Links",
    addLink: "+ Link",
    linkAddTitle: "Link toevoegen",
    linkEditTitle: "Link bewerken",
    linkUrlLabel: "URL of bestandspad",
    linkUrlCaption: "Adres of bestandspad",
    linkTitleLabel: "Titel (optioneel)",
    linkTitleCaption: "Label",
    linkUrlPlaceholder: "https://… of S:\\map\\bestand",
    add: "Toevoegen",
    fullAddTitle: "Nieuwe taak",
    // detailpaneel
    panelKicker: (pos: number | null, total: number) =>
      pos != null ? `Taak · stap ${pos} van ${total}` : "Losse taak",
    moreButton: "Meer",
    lessButton: "Minder",
    noDescription: "Geen omschrijving",
    attributesLabel: "Kenmerken",
    noAttributes: "Geen kenmerken voor deze taak.",
    clickToEdit: "Klik om te bewerken",
    panelEditHint: "Klik een waarde om ze te wijzigen",
    editTitleAria: "Titel bewerken",
    empty: "Leeg",
    selectPlaceholder: "Kies…",
    selectDone: "Klaar",
    perProjectReminder: "wordt automatisch berekend per project",
    duplicate: "Dupliceren",
    delete: "Verwijderen",
    deleteTitle: (title: string) => `${title} verwijderen`,
    deleteBody:
      "De taak wordt verwijderd, samen met haar herinneringen. De overige taken schuiven door.",
    deleteVerb: "Verwijderen",
    // verplaatsen
    moveLabel: "Naar project verplaatsen",
    moveSearch: "Zoek een project…",
    moveCurrent: "Huidig project",
    moveClearWarning: (names: string) =>
      `Kenmerken van een ander sjabloon worden leeggemaakt: ${names}.`,
    numberDotError: "Gebruik een komma als decimaalteken, geen punt.",
    numberInvalid: "Vul een getal in, bv. 1,5.",
    // bulk
    bulkSelected: (n: number) =>
      n === 1 ? "1 taak geselecteerd" : `${n} taken geselecteerd`,
    bulkDelete: "Verwijderen",
    bulkDeleteTitle: (n: number) =>
      n === 1 ? "1 taak verwijderen" : `${n} taken verwijderen`,
    bulkDeleteBody:
      "De geselecteerde taken worden verwijderd, samen met hun herinneringen. Posities schuiven door.",
  },

  // De zeven afgeleide herinnering-toestanden (spec §6.3).
  reminderStates: {
    pending: {
      label: "Gepland",
      hint: "Het sturen staat vast en ligt in de toekomst.",
    },
    waiting: {
      label: "Wacht op status",
      hint: "Status-gebaseerd; de taak heeft de triggerstatus nog niet.",
    },
    inactive: {
      label: "Slaapt",
      hint: "Geen deadline, geen eerdere of latere taak, of het project is gearchiveerd.",
    },
    fired: {
      label: "Gestuurd",
      hint: "De melding is getoond terwijl de app aan stond.",
    },
    late: {
      label: "Laat gestuurd",
      hint: "De app stond dicht toen het moment verstreek; de melding kwam bij het opstarten.",
    },
    seen: {
      label: "Gezien",
      hint: "Je hebt deze herinnering als gezien gemarkeerd.",
    },
    done: {
      label: "Afgerond",
      hint: "De taak staat op de afgerond-status; de herinnering vuurt niet meer.",
    },
  },

  reminders: {
    newReminder: "Nieuwe herinnering",
    modeRelative: "Relatief",
    modeFixed: "Vaste datum",
    remindMe: "Herinner me",
    remindMeOn: "Herinner me op",
    of: "van",
    at: "om",
    day: "dag",
    days: "dagen",
    hour: "uur",
    hours: "uren",
    before: "vóór",
    after: "ná",
    deadline: "de deadline",
    statusWord: "de status",
    anchorThis: "deze taak",
    anchorPrev: "de vorige taak",
    anchorNext: "de volgende taak",
    fromStatus: "Vanaf status",
    previousTask: "Vorige taak",
    nextTask: "Volgende taak",
    timeStruck: "Tijdstip vervalt bij uren",
    timeNa: "niet van toepassing bij uren",
    beforeOnlyDeadline: '"Vóór" kan enkel bij een deadline.',
    perProjectLine: "Wordt automatisch berekend per project",
    perProjectHint:
      "Bij aanmaak van een project wordt dit automatisch berekend gebaseerd op de status of deadline van deze taak (of voorgaande/volgende taak).",
    absoluteInProject:
      "In een sjabloon geldt deze datum letterlijk voor elke taak die uit het sjabloon ontstaat.",
    relativeWithinProjectOnly:
      "Vorige en volgende taak kunnen enkel binnen een project.",
    add: "Toevoegen",
    cancel: "Annuleren",
    save: "Bewaren",
  },
} as const;

export type Nl = typeof nl;
