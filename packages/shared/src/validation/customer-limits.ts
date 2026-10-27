/** Customer transport input bounds shared by the two application boundaries. */
export const CustomerInputLimits = {
  NAME: 200,
  PHONE_RAW: 64,
  EMAIL: 254,
  NOTE: 5000,
  ADDRESS_LABEL: 100,
  RECIPIENT_NAME: 200,
  ADDRESS_TEXT: 2000,
  COUNTRY_CODE: 2,
  QUERY_TEXT: 200,
} as const;
