export const FIELD_TYPES = [
  { value: 'text',         label: 'Text',                   color: '#dbeafe', text: '#1d4ed8', symbol: 'T'  },
  { value: 'number',       label: 'Number',                 color: '#d1fae5', text: '#065f46', symbol: '#'  },
  { value: 'date',         label: 'Date',                   color: '#ede9fe', text: '#5b21b6', symbol: '📅' },
  { value: 'checkbox',     label: 'Checkbox',               color: '#fef3c7', text: '#92400e', symbol: '☑'  },
  { value: 'combobox',     label: 'Combobox',               color: '#cffafe', text: '#155e75', symbol: '▼'  },
  { value: 'multi-select', label: 'Multi Select',           color: '#fce7f3', text: '#9d174d', symbol: '≡'  },
  { value: 'rich-text',    label: 'Rich Text',              color: '#e0e7ff', text: '#3730a3', symbol: '¶'  },
  { value: 'email',        label: 'Email',                  color: '#fee2e2', text: '#991b1b', symbol: '@'  },
  { value: 'phone',        label: 'Phone',                  color: '#fef9c3', text: '#78350f', symbol: '☎'  },
  { value: 'url',          label: 'URL',                    color: '#ccfbf1', text: '#065f46', symbol: '🔗' },
];

export const getFieldType = (value: string) =>
  FIELD_TYPES.find(t => t.value === value) ?? FIELD_TYPES[0];