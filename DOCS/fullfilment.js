// Webhook for the COVID-19 Bot.
// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues.
//
// NOTE: the example code in this template will log user interactions.
'use strict';

const functions = require('firebase-functions');
const { WebhookClient } = require('dialogflow-fulfillment');
const { Payload } = require('dialogflow-fulfillment');
const MapsClient = require('@googlemaps/google-maps-services-js').Client;
const { BigQuery } = require('@google-cloud/bigquery');

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

// Pronoun context
const PRONOUNS = 'pronouns';
const Q1 = 'q1-pronouns';
// Context names for each question
const Q2 = 'q2-ill';
const Q3 = 'q3-infant';
const Q4 = 'q4-child';
const Q5 = 'q5-age_risk';
/* No Q6 context as it's identical to Q5 other than pronouns.
 * Skip number to stay consistent with spec document */
const Q7 = 'q7-child_extreme';
const Q8 = 'q8-child_severe';
const Q9 = 'q9-child_severe_cont';
const Q10 = 'q10-extreme';
const Q11 = 'q11-contact';
const Q12 = 'q12-travel';
const Q13 = 'q13-fever';
const Q14 = 'q14-short_of_breath';
const Q15 = 'q15-breathing_severe_extreme';
const Q16 = 'q16-breathing_severe_extreme_cont';
const Q17 = 'q17-cough';
const Q18 = 'q18-cough_severe';
const Q19 = 'q19-blood_pressure_extreme';
const Q20 = 'q20-symptoms';
const Q21 = 'q21-lung';
const Q22 = 'q22-cardio';
const Q23 = 'q23-dm';
const Q24 = 'q24-risks';
const Q25 = 'q25-ltc';
const Q26 = 'q26-hcp';
const END = 'end';

// Special Intents
const YES_INTENT = 'q.yes';
const NO_INTENT = 'q.no';

// Labels
const NOT_ILL = 'NOT_ILL';
const INFANT = 'INFANT';
const EXTREME = 'EXTREME';
const SEVERE = 'SEVERE';
const SEVERE_EXTREME = 'SEVERE_EXTREME';
const HEALTHRISK = 'HEALTHRISK';
const EXPOSURE = 'EXPOSURE';
const SYMPTOMATIC = 'SYMPTOMATIC';
const ASYMPTOMATIC = 'ASYMPTOMATIC';
const FEVER = 'FEVER';
const COUGH = 'COUGH';
const SHORT_OF_BREATH = 'SHORT_OF_BREATH';
const LUNG = 'LUNG';
const CARDIO = 'CARDIO';
const DM = 'DM';
const LTC = 'LTC';
const HCP = 'HCP';
// Pronoun Labels
const ME = 'ME';
const SOMEONE_ELSE = 'SOMEONE_ELSE';

// Q2 require more logic than just a mapping. See: "getNextQuestionCtx()"
const QUESTION_FLOW_MAP = {
    [Q3]: {
        [YES_INTENT]: Q7, [NO_INTENT]: Q4 },
    [Q4]: {
        [YES_INTENT]: Q8, [NO_INTENT]: Q5 },
    [Q5]: {
        [YES_INTENT]: Q10, [NO_INTENT]: Q10 },
    [Q7]: {
        [YES_INTENT]: END, [NO_INTENT]: END },
    [Q8]: {
        [YES_INTENT]: END, [NO_INTENT]: Q9 },
    [Q9]: {
        [YES_INTENT]: END, [NO_INTENT]: Q10 },
    [Q10]: {
        [YES_INTENT]: END, [NO_INTENT]: Q11 },
    [Q11]: {
        [YES_INTENT]: Q12, [NO_INTENT]: Q12 },
    [Q12]: {
        [YES_INTENT]: Q13, [NO_INTENT]: Q13 },
    [Q13]: {
        [YES_INTENT]: Q14, [NO_INTENT]: Q14 },
    [Q14]: {
        [YES_INTENT]: Q15, [NO_INTENT]: Q17 },
    [Q15]: {
        [YES_INTENT]: END, [NO_INTENT]: Q16 },
    [Q16]: {
        [YES_INTENT]: END, [NO_INTENT]: Q17 },
    [Q17]: {
        [YES_INTENT]: Q18, [NO_INTENT]: Q19 },
    [Q18]: {
        [YES_INTENT]: END, [NO_INTENT]: Q19 },
    [Q19]: {
        [YES_INTENT]: END, [NO_INTENT]: Q20 },
    [Q20]: {
        [YES_INTENT]: Q21, [NO_INTENT]: Q21 },
    [Q21]: {
        [YES_INTENT]: Q22, [NO_INTENT]: Q22 },
    [Q22]: {
        [YES_INTENT]: Q23, [NO_INTENT]: Q23 },
    [Q23]: {
        [YES_INTENT]: Q24, [NO_INTENT]: Q24 },
    [Q24]: {
        [YES_INTENT]: Q25, [NO_INTENT]: Q25 },
    [Q25]: {
        [YES_INTENT]: Q26, [NO_INTENT]: Q26 },
    [Q26]: {
        [YES_INTENT]: END, [NO_INTENT]: END }
};

const QUESTION_ANSWER_LABEL_MAP = {
    [Q2]: {
        [YES_INTENT]: [], [NO_INTENT]: [NOT_ILL] },
    [Q3]: {
        [YES_INTENT]: [], [NO_INTENT]: [] },
    [Q4]: {
        [YES_INTENT]: [], [NO_INTENT]: [] },
    [Q5]: {
        [YES_INTENT]: [HEALTHRISK], [NO_INTENT]: [] },
    [Q7]: {
        [YES_INTENT]: [EXTREME], [NO_INTENT]: [INFANT] },
    [Q8]: {
        [YES_INTENT]: [SEVERE], [NO_INTENT]: [] },
    [Q9]: {
        [YES_INTENT]: [SEVERE], [NO_INTENT]: [] },
    [Q10]: {
        [YES_INTENT]: [EXTREME], [NO_INTENT]: [] },
    [Q11]: {
        [YES_INTENT]: [EXPOSURE], [NO_INTENT]: [] },
    [Q12]: {
        [YES_INTENT]: [EXPOSURE], [NO_INTENT]: [] },
    [Q13]: {
        [YES_INTENT]: [FEVER, SYMPTOMATIC], [NO_INTENT]: [] },
    [Q14]: {
        [YES_INTENT]: [SHORT_OF_BREATH, SYMPTOMATIC], [NO_INTENT]: [] },
    [Q15]: {
        [YES_INTENT]: [SEVERE_EXTREME], [NO_INTENT]: [] },
    [Q16]: {
        [YES_INTENT]: [SEVERE_EXTREME], [NO_INTENT]: [] },
    [Q17]: {
        [YES_INTENT]: [COUGH, SYMPTOMATIC], [NO_INTENT]: [] },
    [Q18]: {
        [YES_INTENT]: [SEVERE], [NO_INTENT]: [] },
    [Q19]: {
        [YES_INTENT]: [SEVERE_EXTREME], [NO_INTENT]: [] },
    [Q20]: {
        [YES_INTENT]: [SYMPTOMATIC], [NO_INTENT]: [ASYMPTOMATIC] },
    [Q21]: {
        [YES_INTENT]: [LUNG, HEALTHRISK], [NO_INTENT]: [] },
    [Q22]: {
        [YES_INTENT]: [CARDIO, HEALTHRISK], [NO_INTENT]: [] },
    [Q23]: {
        [YES_INTENT]: [DM, HEALTHRISK], [NO_INTENT]: [] },
    [Q24]: {
        [YES_INTENT]: [HEALTHRISK], [NO_INTENT]: [] },
    [Q25]: {
        [YES_INTENT]: [LTC], [NO_INTENT]: [] },
    [Q26]: {
        [YES_INTENT]: [HCP], [NO_INTENT]: [] },
};

/**
 * Generate HTML for hyperlinks.
 */
function formatHyperlink(text, url) {
    return `<a href="${url}">${text}</a>`;
}
/**
 * Generate HTML for appending sources to cards.
 */
function formatSourceHTML(text, url) {
    return `<b>Source: </b>${formatHyperlink(text, url)}`;
}

// Sources
const CDC_SOURCE = `${formatSourceHTML("CDC", "https://www.cdc.gov/coronavirus/2019-ncov/index.html")}`;
const CDC_HOUSEHOLD_SOURCE = `${formatSourceHTML("Household Checklist, CDC", "https://www.cdc.gov/coronavirus/2019-ncov/daily-life-coping/checklist-household-ready.html")}`;
const CDC_SYMPTOMS_SOURCE = `${formatSourceHTML("Symptoms, CDC", "https://www.cdc.gov/coronavirus/2019-ncov/symptoms-testing/symptoms.html")}`;
const DIABETES_SOURCE = `${formatSourceHTML("COVID-19 Resources, American Diabetes Association", "https://www.diabetes.org/coronavirus-covid-19")}`;
const HEART_SOURCE = `${formatSourceHTML("COVID-19 Resources, American Heart Association", "https://www.heart.org/en/about-us/coronavirus-covid-19-resources")}`;
const LUNG_SOURCE = `${formatSourceHTML("COVID-19 Resources, American Lung Association", "https://www.lung.org/about-us/media/top-stories/update-covid-19.html")}`;
const CDC_AGE_SOURCE = `${formatSourceHTML("Older Adults, CDC", "https://www.cdc.gov/coronavirus/2019-ncov/specific-groups/high-risk-complications/older-adults.html")}`;

// Links
const CDC_MAIN = `${formatHyperlink("COVID-19 Resources For the Public (CDC)", "https://www.cdc.gov/coronavirus/2019-ncov/index.html")}`;
const CDC_HOUSEHOLD_CHECKLIST = `${formatHyperlink("Household Checklist (CDC)", "https://www.cdc.gov/coronavirus/2019-ncov/daily-life-coping/checklist-household-ready.html")}`;
const CDC_ERRANDS = `${formatHyperlink("Running Essential Errands (CDC)", "https://www.cdc.gov/coronavirus/2019-ncov/daily-life-coping/essential-goods-services.html")}`;
const CDC_STRESS = `${formatHyperlink("Stress and Coping (CDC)", "https://www.cdc.gov/coronavirus/2019-ncov/daily-life-coping/managing-stress-anxiety.html")}`;
const CDC_CHILDREN = `${formatHyperlink("Caring for Children (CDC)", "https://www.cdc.gov/coronavirus/2019-ncov/daily-life-coping/children.html")}`;
const CDC_RECREATION = `${formatHyperlink("Visiting Parks and Recreational Facilities (CDC)", "https://www.cdc.gov/coronavirus/2019-ncov/daily-life-coping/visitors.html")}`;
const CDC_PETS = `${formatHyperlink("If You Have Animals (CDC)", "https://www.cdc.gov/coronavirus/2019-ncov/daily-life-coping/animals.html")}`;
const CDC_COPING = `${formatSourceHTML("Daily Life and Coping, CDC", "https://www.cdc.gov/coronavirus/2019-ncov/daily-life-coping/index.html")}`;
const CDC_PROTECT = `${formatHyperlink("How to Protect Yourself (CDC)", "https://www.cdc.gov/coronavirus/2019-ncov/prepare/prevention.html")}`;
const CDC_SICK = `${formatHyperlink("What to Do if Sick (CDC)", "https://www.cdc.gov/coronavirus/2019-ncov/about/steps-when-sick.html")}`;
const CDC_QA = `${formatHyperlink("Questions & Answers (CDC)", "https://www.cdc.gov/coronavirus/2019-ncov/faq.html")}`;
const WHO_ADVICE = `${formatHyperlink("Advice For the Public (WHO)", "https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public")}`;
const GOOGLE_HELP = `${formatHyperlink("Help & Info (Google)", "https://www.google.com/search?q=coronavirus")}`;
const TWITTER_CDC = `${formatHyperlink("@CDCgov", "https://twitter.com/CDCgov")}`;
const TWITTER_CDC_EMERGENCY = `${formatHyperlink("@CDCemergency", "https://twitter.com/CDCemergency")}`;
const TWITTER_WHO = `${formatHyperlink("@WHO", "https://twitter.com/WHO")}`;
const YOUTUBE_CDC_PREVENT = `${formatHyperlink("Steps to Prevent COVID-19 (CDC)", "https://www.youtube.com/watch?v=9Ay4u7OYOhA")}`;
const YOUTUBE_CDC_WASH = `${formatHyperlink("Hand-Washing (CDC)", "https://www.youtube.com/watch?v=d914EnpU4Fo")}`;
const YOUTUBE_CDC_MANAGE = `${formatHyperlink("Managing COVID-19 At Home (CDC))", "https://www.youtube.com/watch?v=qPoptbtBjkg")}`;

// Placeholder text for user pronoun selections.
const PRONOUN1 = '-pronoun1-';
const PRONOUN1_UP = '-pronoun1_up-';
const PRONOUN2 = '-pronoun2-';

const CARD_CM_A = [{
    'title': `Learn how to plan, prepare, and cope with stress during a COVID-19 outbreak`,
    'type': 'accordion',
    'text': `Helpful resources:<ul><li>${CDC_HOUSEHOLD_CHECKLIST}</li><li>${CDC_ERRANDS}</li><li>${CDC_STRESS}</li><li>${CDC_CHILDREN}</li><li>${CDC_RECREATION}</li><li>${CDC_PETS}</li></ul>${CDC_COPING}`
}];

const CARD_CM_A_TELEPHONY = `Visit CDC.gov/coronavirus to learn how to plan, prepare, and cope with stress during a COVID-19 outbreak. Do you have any other questions?`;

const CARD_CM_B = [{
    'title': `Call 911 now`,
    'type': 'accordion',
    'text': `${PRONOUN1_UP} may be having a medical emergency. ${PRONOUN1_UP} need immediate medical attention.<br><br>${CDC_SOURCE}`
}];

const CARD_CM_B_TELEPHONY = `Call 911 now. ${PRONOUN1_UP} may be having a medical emergency. ${PRONOUN1_UP} need immediate medical attention. Source: CDC.`;

const CARD_CM_C = [{
    'title': `Seek medical care if your child is sick`,
    'type': 'accordion',
    'text': `If the child is under two years old and sick, contact their healthcare provider as soon as possible.<br><br>Tell their provider if:<ul><li>The child had contact with someone with COVID-19</li><li>The child has been in an area where COVID-19 is spreading</li></ul>${CDC_SOURCE}`
}];

const CARD_CM_C_TELEPHONY = `Seek medical care if your child is sick. If the child is under two years old and sick, contact their healthcare provider as soon as possible. Tell their provider if the child had contact with someone with COVID-19 or The child has been in an area where COVID-19 is spreading. Source: CDC.`;

const CARD_CM_D = [{
    'title': `Go to the emergency department now`,
    'type': 'accordion',
    'text': `${PRONOUN1_UP} may need urgent medical attention.<br><br>Tell the medical staff if:<ul><li>${PRONOUN1_UP} had contact with someone with COVID-19</li><li>${PRONOUN1_UP} recently visited an area where COVID-19 is spreading</li></ul>${CDC_SOURCE}`
}];

const CARD_CM_D_TELEPHONY = `Go to the emergency department now. ${PRONOUN1_UP} may need urgent medical attention.Tell the medical staff if ${PRONOUN1} had contact with someone with COVID-19 or ${PRONOUN1} recently visited an area where COVID-19 is spreading. Source: CDC.`;

const CARD_CM_E = [{
    'title': `Call ${PRONOUN2} healthcare provider in the next 24 hours`,
    'type': 'accordion',
    'text': `${PRONOUN1_UP} have at least one symptom that may be related to COVID-19. ${PRONOUN1_UP} also have at least one condition that means ${PRONOUN1} may be at greater risk for complications from COVID-19.<br><br>If a call back is not received within 24 hours, see a medical provider. If symptoms get worse, seek care at an urgent care center or emergency department.`
}];

const CARD_CM_E_TELEPHONY = `Call ${PRONOUN2} healthcare provider in the next 24 hours. ${PRONOUN1_UP} have at least one symptom that may be related to COVID-19. ${PRONOUN1_UP} also have at least one condition that means ${PRONOUN1} may be at greater risk for complications from COVID-19. If a call back is not received within 24 hours, see a medical provider. If symptoms get worse, seek care at an urgent care center or emergency department.`;

const CARD_CM_F = [{
    'title': `Contact the occupational health provider at ${PRONOUN2} workplace immediately`,
    'type': 'accordion',
    'text': `If ${PRONOUN1} don't have an occupational health provider at ${PRONOUN2} workplace, seek care with ${PRONOUN2} usual provider.<br><br>Be sure to mention if:<ul><li>${PRONOUN1_UP} work in a healthcare setting and may have been exposed to COVID-19</li><li>${PRONOUN1_UP} have cared for a person who is sick with COVID-19</ul></li><br><br>If symptoms get worse, go to an urgent care center or emergency department, but call ahead to let them know the details above.<br><br>${CDC_SOURCE}`
}];

const CARD_CM_F_TELEPHONY = `Contact the occupational health provider at ${PRONOUN2} workplace immediately. If ${PRONOUN1} don't have an occupational health provider at ${PRONOUN2} workplace, seek care with ${PRONOUN2} usual provider. Be sure to mention if ${PRONOUN1} work in a healthcare setting and may have been exposed to COVID-19 or ${PRONOUN1} have cared for a person who is sick with COVID-19. If symptoms get worse, go to an urgent care center or emergency department, but call ahead to let them know the details above. Source: CDC.`;

const CARD_CM_G = [{
    'title': `Contact a healthcare provider at the facility where ${PRONOUN1} live`,
    'type': 'accordion',
    'text': `${PRONOUN1_UP} may be at higher risk of COVID-19 because ${PRONOUN1} live in a nursing home or long-term care facility.<br>Tell a caregiver at the facility that ${PRONOUN1} are sick and need to see a medical provider as soon as possible.<br><br>${CDC_SOURCE}`
}];

const CARD_CM_G_TELEPHONY = `Contact a healthcare provider at the facility where ${PRONOUN1} live. ${PRONOUN1_UP} may be at higher risk of COVID-19 because ${PRONOUN1} live in a nursing home or long-term care facility. Tell a caregiver at the facility that ${PRONOUN1} are sick and need to see a medical provider as soon as possible. Source: CDC.`;

const CARD_CM_H = [{
    'title': `${PRONOUN1_UP} should stay home and call ${PRONOUN2} provider if ${PRONOUN2} symptoms get worse`,
    'type': 'accordion',
    'text': `In the meantime, ${PRONOUN1} should follow these steps:<ul><li>Drink plenty of water and other clear liquids to prevent dehydration</li><li>Take over-the-counter medicines, such as acetaminophen, to help feel better</li></ul><br><br>${CDC_SOURCE}`
}];

const CARD_CM_H_TELEPHONY = `${PRONOUN1_UP} should stay home and call ${PRONOUN2} provider if ${PRONOUN2} symptoms get worse. In the meantime, ${PRONOUN1} should drink plenty of water and other clear liquids to prevent dehydration and take over-the-counter medicines, such as acetaminophen, to help feel better. Source: CDC.`;

const CARD_CM_I = [{
    'title': `Call 911 or go to the emergency department now`,
    'type': 'accordion',
    'text': `${PRONOUN1_UP} may need urgent medical attention. Call 911 or go to ${PRONOUN2} nearest emergency department right away.<br><br>Tell the medical staff if:<ul><li>${PRONOUN1_UP} had contact with someone with COVID-19</li><li>${PRONOUN1_UP} recently visited an area where COVID-19 is spreading</li></ul>${CDC_SOURCE}`
}];

const CARD_CM_I_TELEPHONY = `Call 911 or go to the emergency department now. ${PRONOUN1_UP} may need urgent medical attention. Call 911 or go to ${PRONOUN2} nearest emergency department right away. Tell the medical staff if ${PRONOUN1} had contact with someone with COVID-19 or ${PRONOUN1} recently visited an area where COVID-19 is spreading. Source: CDC.`;

const CARD_AC1 = [{
    'title': `${PRONOUN1_UP} should stay in ${PRONOUN2} room except to get medical care`,
    'type': 'accordion',
    'text': `To prevent getting other people sick ${PRONOUN1} should stay in ${PRONOUN2} room or apartment until ${PRONOUN1} can talk with a healthcare provider in ${PRONOUN2} facility.<br><br>Cover mouth and nose with a cloth face mask when outside the room.<br><br>${CDC_SOURCE}`
}];

const CARD_AC1_TELEPHONY = `${PRONOUN1_UP} should stay in ${PRONOUN2} room except to get medical care. To prevent getting other people sick ${PRONOUN1} should stay in ${PRONOUN2} room or apartment until ${PRONOUN1} can talk with a healthcare provider in ${PRONOUN2} facility. Cover mouth and nose with a cloth face mask when outside the room. Source: CDC.`;

const CARD_AC2 = [{
    'title': `${PRONOUN1_UP} should stay home except to get medical care`,
    'type': 'accordion',
    'text': `${PRONOUN1_UP} should stay home until talking with a healthcare provider. Until then to prevent getting other people sick, ${PRONOUN1} should:<ul><li>Restrict activities outside the home, except for getting medical care</li><li>Avoid work, school, or public areas</li><li>Avoid using public transportation, ride-sharing, or taxis</li></ul>${CDC_SOURCE}`
}];

const CARD_AC2_TELEPHONY = `${PRONOUN1_UP} should stay home except to get medical care. ${PRONOUN1_UP} should stay home until talking with a healthcare provider. Until then to prevent getting other people sick, ${PRONOUN1} should restrict activities outside the home, except for getting medical care; avoid work, school, or public areas; and avoid using public transportation, ride-sharing, or taxis. Source: CDC.`;

const CARD_AC3 = [{
    'title': `${PRONOUN1_UP} should stay separated from other people and pets`,
    'type': 'accordion',
    'text': `If ${PRONOUN1} live with other people or pets, as much as possible ${PRONOUN1} should stay in ${PRONOUN2} own room and away from other people and pets, and ideally use a separate bathroom.<br><br>${CDC_SOURCE}`
}];

const CARD_AC3_TELEPHONY = `${PRONOUN1_UP} should stay separated from other people and pets. If ${PRONOUN1} live with other people or pets, as much as possible ${PRONOUN1} should stay in ${PRONOUN2} own room and away from other people and pets, and ideally use a separate bathroom. Source: CDC.`;

const CARD_AC4 = [{
    'title': `${PRONOUN1_UP} should wear a cloth face mask, if possible`,
    'type': 'accordion',
    'text': `${PRONOUN1_UP} should wear a cloth face mask when:<ul><li>Sharing a room or vehicle with other people</li><li>Entering a healthcare provider's office </li><li>Going out in public</li></ul>If ${PRONOUN1} aren't able to wear a cloth face mask, other members of the household shouldn't stay in the same room unless they wear a cloth face mask.<br><br>${CDC_SOURCE}`
}];

const CARD_AC4_TELEPHONY = `${PRONOUN1_UP} should wear a cloth face mask, if possible. ${PRONOUN1_UP} should wear a cloth face mask when sharing a room or vehicle with others, entering a healthcare provider's office, or going out in public. If ${PRONOUN1} aren't able to wear a cloth face mask, other members of the household shouldn't stay in the same room unless they wear a cloth face mask. Source: CDC.`;

const CARD_AC5 = [{
    'title': `Cover coughs and sneezes`,
    'type': 'accordion',
    'text': `Cover the mouth and nose with a tissue when coughing or sneezing. Throw used tissues in a lined trash can and immediately wash hands.<br><br>${CDC_SOURCE}`
}];

const CARD_AC5_TELEPHONY = `Cover coughs and sneezes. Cover the mouth and nose with a tissue when coughing or sneezing. Throw used tissues in a lined trash can and immediately wash hands. Source: CDC.`;

const CARD_AC6 = [{
    'title': `Clean hands often`,
    'type': 'accordion',
    'text': `To prevent spreading illness or getting sick, always keep hands clean by:<ul><li>Washing them often with soap and water for at least 20 seconds</li><li>Covering them with a sanitizer that contains 60-95% alcohol, then rubbing hands together until they feel dry</li></ul>Washing with soap and water is the best option to clean visibly dirty hands.<br>Avoid touching the eyes, nose, or mouth with unwashed hands.<br><br>${CDC_SOURCE}`
}];

const CARD_AC6_TELEPHONY = `Clean hands often. To prevent spreading illness or getting sick, always keep hands clean by washing them often with soap and water for at least 20 seconds or covering them with a sanitizer that contains 60-95% alcohol, then rubbing hands together until they feel dry. Washing with soap and water is the best option to clean visibly dirty hands. Avoid touching the eyes, nose, or mouth with unwashed hands. Source: CDC.`;

const CARD_AC7 = [{
    'title': `Don't share personal household items`,
    'type': 'accordion',
    'text': `${PRONOUN1_UP} shouldn't share dishes, cups, utensils, towels, or bedding with other people or pets in the home.<br><br>These items should be washed thoroughly with soap and water after use.<br><br>${CDC_SOURCE}`
}];

const CARD_AC7_TELEPHONY = `Don't share personal household items. ${PRONOUN1_UP} shouldn't share dishes, cups, utensils, towels, or bedding with other people or pets in the home. These items should be washed thoroughly with soap and water after use. Source: CDC.`;

const CARD_AC8 = [{
    'title': `Clean frequently-used surfaces every day`,
    'type': 'accordion',
    'text': `Use a household cleaning spray or wipe to clean:<ul><li>Surfaces such as counters, tabletops, doorknobs, bathroom fixtures, toilets, and bedside tables</li><li>Devices such as phones, keyboards, and tablets</li><li>Any surfaces with blood, stool, or body fluids on them</li></ul>Be sure to follow the instructions on the label of the cleaning product for safe and effective use.<br><br>${CDC_SOURCE}`
}];

const CARD_AC8_TELEPHONY = `Clean frequently-used surfaces every day. Use a household cleaning spray or wipe to clean surfaces such as counters, tabletops, doorknobs, bathroom fixtures, toilets, and bedside tables, devices such as phones, keyboards, and tablets, and any surfaces with blood, stool, or body fluids on them. Be sure to follow the instructions on the label of the cleaning product for safe and effective use. Source: CDC.`;

const CARD_AC9 = [{
    'title': `Monitor ${PRONOUN2} symptoms`,
    'type': 'accordion',
    'text': `${PRONOUN1_UP} should seek medical attention right away if ${PRONOUN2} symptoms get worse.<br><br>${PRONOUN1_UP} should put on a cloth face mask before entering a healthcare facility to prevent others from getting sick.<br><br>${CDC_SOURCE}`
}];

const CARD_AC9_TELEPHONY = `Monitor ${PRONOUN2} symptoms. ${PRONOUN1_UP} should seek medical attention right away if ${PRONOUN2} symptoms get worse. ${PRONOUN1_UP} should put on a cloth face mask before entering a healthcare facility to prevent others from getting sick. Source: CDC.`;

const CARD_AC10 = [{
    'title': `Take steps to avoid getting or spreading COVID-19`,
    'type': 'accordion',
    'text': `<ul><li>Wash hands frequently</li><li>Avoid touching eyes, nose, and mouth</li><li>Stay home when sick</li><li>Cover a cough or sneeze with a tissue, then throw the tissue in the trash</li><li>Clean and disinfect frequently touched objects and surfaces everyday</li><li>Cover mouth and nose with a cloth face mask when going out in public</li></ul>${CDC_HOUSEHOLD_SOURCE}`
}];

const CARD_AC10_TELEPHONY = `Take steps to avoid getting or spreading COVID-19. Wash hands frequently. Avoid touching eyes, nose, and mouth. Stay home when sick. Cover a cough or sneeze with a tissue, then throw the tissue in the trash. Clean and disinfect frequently touched objects and surfaces everyday. Cover mouth and nose with a cloth face mask when going out in public. Source: Household Checklist, CDC.`;

const CARD_AC11 = [{
    'title': `Know the symptoms`,
    'type': 'accordion',
    'text': `Symptoms include:<ul><li>Fever, with a temperature above 100.4 °F or 38 °C</li><li>Cough</li><li>Shortness of breath or difficulty breathing</li><li>Chills</li><li>Muscle Pain</li><li>Sore throat</li><li>New loss of taste or smell</li></ul>Get medical attention right away if any of these emergency warning signs develop:<ul><li>Difficulty breathing</li><li>Constant chest pain or pressure</li><li>New confusion or new difficulty waking up</li><li>Bluish lips or face</li></ul>This list is not inclusive. Other less common symptoms have been reported, including gastrointestinal symptoms like nausea, vomiting, or diarrhea. Contact a medical provider for any severe or concerning symptoms.${CDC_SYMPTOMS_SOURCE}`
}];

const CARD_AC11_TELEPHONY = `Know the symptoms of COVID-19. Symptoms include fever, with a temperature above 100.4 °F or 38 °C, cough, shortness of breath or difficulty breathing, chills, muscle pain, sore throat, and new loss of taste or smell. This list is not all inclusive. Other less common symptoms have been reported, including gastrointestinal symptoms like nausea, vomiting, or diarrhea. Get medical attention right away if any of these emergency warning signs develop: difficulty breathing, constant chest pain or pressure, new confusion or new difficulty waking up, bluish lips or face. Source: Symptoms, CDC.`;

const CARD_HF1 = [{
    'title': `Make a plan if ${PRONOUN1} have diabetes`,
    'type': 'accordion',
    'text': `${PRONOUN1_UP} may be at higher risk of getting very sick from COVID-19. ${PRONOUN1_UP} should take these steps:<ul><li>Gather phone numbers for ${PRONOUN2} doctor and pharmacies, lists of medications, testing supplies, and prescription refills</li><li>Have enough household items and groceries on hand in case an extended stay at home is needed</li><li>Call ${PRONOUN2} doctor if ${PRONOUN1} develop new symptoms such as fever, cough, or shortness of breath</li><li>Meet with ${PRONOUN2} doctor through telehealth options, if available</li></ul>${DIABETES_SOURCE}`
}];

const CARD_HF1_TELEPHONY = `Make a plan if ${PRONOUN1} have diabetes. ${PRONOUN1_UP} may be at higher risk of getting very sick from COVID-19. ${PRONOUN1_UP} should take these steps: gather phone numbers for ${PRONOUN2} doctor and pharmacies, lists of medications, testing supplies, and prescription refills. Have enough household items and groceries on hand in case an extended stay at home is needed. Call ${PRONOUN2} doctor if ${PRONOUN1} develop new symptoms such as fever, cough, or shortness of breath. Meet with ${PRONOUN2} doctor through telehealth options, if available. Source: COVID-19 Resources, American Diabetes Association.`;

const CARD_HF2 = [{
    'title': `Make a plan if ${PRONOUN1} have heart disease`,
    'type': 'accordion',
    'text': `${PRONOUN1_UP} may be at higher risk of getting very sick from COVID-19. ${PRONOUN1_UP} should take these steps:<ul><li>Gather phone numbers for ${PRONOUN2} doctor and pharmacies, lists of medications, testing supplies, and prescription refills</li><li>Have enough household items and groceries on hand in case an extended stay at home is needed</li><li>Recognize and manage stress</li><li>Stay current with vaccinations, including pneumonia and flu shots</li></ul>${HEART_SOURCE}`
}];

const CARD_HF2_TELEPHONY = `Make a plan if ${PRONOUN1} have heart disease. ${PRONOUN1_UP} may be at higher risk of getting very sick from COVID-19. ${PRONOUN1_UP} should take these steps: Gather phone numbers for ${PRONOUN2} doctor and pharmacies, lists of medications, testing supplies, and prescription refills. Have enough household items and groceries on hand in case an extended stay at home is needed. Recognize and manage stress. Stay current with vaccinations, including pneumonia and flu shots. Source: COVID-19 Resources, American Heart Association.`;

const CARD_HF3 = [{
    'title': `Make a plan if ${PRONOUN1} have lung disease`,
    'type': 'accordion',
    'text': `${PRONOUN1_UP} may be at higher risk of getting very sick from COVID-19. ${PRONOUN1_UP} should take these steps:<ul><li>Keep a distance of least 6 feet from others</li><li>Call ${PRONOUN2} doctor if ${PRONOUN1} develop new symptoms such as fever, cough, or shortness of breath</li><li>Know and follow ${PRONOUN2} Asthma Action Plan as needed</li><li>Many individuals use a nebulizer to take inhaled medications at home. If ${PRONOUN1} have suspected or diagnosed COVID-19, speak with ${PRONOUN2} healthcare provider about additional precautions to take when using ${PRONOUN2} nebulizer.</li></ul>${LUNG_SOURCE}`
}];

const CARD_HF3_TELEPHONY = `Make a plan if ${PRONOUN1} have lung disease. ${PRONOUN1_UP} may be at higher risk of getting very sick from COVID-19. ${PRONOUN1_UP} should take these steps: Keep a distance of least 6 feet from others. Call ${PRONOUN2} doctor if ${PRONOUN1} develop new symptoms such as fever, cough, or shortness of breath. Know and follow ${PRONOUN2} Asthma Action Plan as needed. Many individuals use a nebulizer to take inhaled medications at home. If ${PRONOUN1} have suspected or diagnosed COVID-19, speak with ${PRONOUN2} healthcare provider about additional precautions to take when using ${PRONOUN2} nebulizer. Source: COVID-19 Resources, American Lung Association.`;

const CARD_HF4 = [{
    'title': `Make a plan if ${PRONOUN1} have higher risk factors`,
    'type': 'accordion',
    'text': `${PRONOUN1_UP} may be at higher risk of getting very sick from COVID-19 due to ${PRONOUN2} age or health history. ${PRONOUN1_UP} should take these steps:<ul><li>Gather phone numbers for ${PRONOUN2} doctor and pharmacies, lists of medications, testing supplies, and prescription refills</li><li>Have enough household items and groceries on hand in case an extended stay at home is needed</li><li>Keep a distance of least 6 feet from others</li><li>Call ${PRONOUN2} doctor if ${PRONOUN1} develop new symptoms such as fever, cough, or shortness of breath</li></ul>${CDC_AGE_SOURCE}`,
}];

const CARD_HF4_TELEPHONY = `Make a plan if ${PRONOUN1} have higher risk factors. ${PRONOUN1_UP} may be at higher risk of getting very sick from COVID-19 due to ${PRONOUN2} age or health history. ${PRONOUN1_UP} should take these steps: Gather phone numbers for ${PRONOUN2} doctor and pharmacies, lists of medications, testing supplies, and prescription refills. Have enough household items and groceries on hand in case an extended stay at home is needed. Keep a distance of least 6 feet from others. Call ${PRONOUN2} doctor if ${PRONOUN1} develop new symptoms such as fever, cough, or shortness of breath. Source: CDC.`;

const CARD_G1 = [{
    'title': `Stay up-to-date on COVID-19`,
    'type': 'accordion',
    'text': `Helpful websites:<ul><li>${CDC_MAIN}</li><li>${WHO_ADVICE}</li><li>${GOOGLE_HELP}</li></ul>Twitter feeds:<ul><li>${TWITTER_CDC}</li><li>${TWITTER_CDC_EMERGENCY}</li><li>${TWITTER_WHO}</li></ul>`
}];

const CARD_G1_TELEPHONY = `Visit CDC.gov/coronavirus to learn more about COVID-19. Do you have any other questions?`;

const CARD_G2 = [{
    'title': `Learn more about staying safe`,
    'type': 'accordion',
    'text': `Learn:<ul><li>${CDC_PROTECT}</li><li>${CDC_SICK}</li><li>${CDC_QA}</li></ul>Watch:<ul><li>${YOUTUBE_CDC_PREVENT}</li><li>${YOUTUBE_CDC_WASH}</li><li>${YOUTUBE_CDC_MANAGE}</li></ul>`
}];

const CARD_G2_TELEPHONY = ``;

const LABEL_CARD_MAP = {
    [HEALTHRISK]: ['HF4'],
    [LUNG]: ['HF3'],
    [CARDIO]: ['HF2'],
    [DM]: ['HF1'],
};
const CARDS_ALL = ['G1', 'G2'];
// Emergency cards do not get additional cards displayed upon completion
const EMERGENCY_CARDS = [
    'CMB',
    'CMC',
    'CMD',
    'CMI'
];

const NO_CARE_MESSAGE = 'NO_CARE_MESSAGE';

const CARE_MESSAGE_TO_ACTION_CARDS = {
    'CMA': ['AC10', 'AC11'],
    'CMB': [],
    'CMC': [],
    'CMD': [],
    'CME': ['AC2', 'AC3', 'AC4', 'AC5', 'AC6', 'AC7', 'AC8', 'AC9'],
    'CMF': ['AC2', 'AC3', 'AC4', 'AC5', 'AC6', 'AC7', 'AC8', 'AC9'],
    'CMG': ['AC1', 'AC5', 'AC6'],
    'CMH': ['AC2', 'AC3', 'AC4', 'AC5', 'AC6', 'AC7', 'AC8', 'AC9'],
    'CMI': [],
    [NO_CARE_MESSAGE]: []
};


const CARDS_REGISTRY = {
    'CMA': { rank: 1, card: CARD_CM_A, telephony: CARD_CM_A_TELEPHONY },
    'CMB': { rank: 2, card: CARD_CM_B, telephony: CARD_CM_B_TELEPHONY },
    'CMC': { rank: 3, card: CARD_CM_C, telephony: CARD_CM_C_TELEPHONY },
    'CMD': { rank: 4, card: CARD_CM_D, telephony: CARD_CM_D_TELEPHONY },
    'CME': { rank: 5, card: CARD_CM_E, telephony: CARD_CM_E_TELEPHONY },
    'CMF': { rank: 6, card: CARD_CM_F, telephony: CARD_CM_F_TELEPHONY },
    'CMG': { rank: 7, card: CARD_CM_G, telephony: CARD_CM_G_TELEPHONY },
    'CMH': { rank: 8, card: CARD_CM_H, telephony: CARD_CM_H_TELEPHONY },
    'CMI': { rank: 9, card: CARD_CM_I, telephony: CARD_CM_I_TELEPHONY },
    'AC1': { rank: 10, card: CARD_AC1, telephony: CARD_AC1_TELEPHONY },
    'AC2': { rank: 11, card: CARD_AC2, telephony: CARD_AC2_TELEPHONY },
    'AC3': { rank: 12, card: CARD_AC3, telephony: CARD_AC3_TELEPHONY },
    'AC4': { rank: 13, card: CARD_AC4, telephony: CARD_AC4_TELEPHONY },
    'AC5': { rank: 14, card: CARD_AC5, telephony: CARD_AC5_TELEPHONY },
    'AC6': { rank: 15, card: CARD_AC6, telephony: CARD_AC6_TELEPHONY },
    'AC7': { rank: 16, card: CARD_AC7, telephony: CARD_AC7_TELEPHONY },
    'AC8': { rank: 17, card: CARD_AC8, telephony: CARD_AC8_TELEPHONY },
    'AC9': { rank: 18, card: CARD_AC9, telephony: CARD_AC9_TELEPHONY },
    'AC10': { rank: 19, card: CARD_AC10, telephony: CARD_AC10_TELEPHONY },
    'AC11': { rank: 20, card: CARD_AC11, telephony: CARD_AC11_TELEPHONY },
    'HF1': { rank: 21, card: CARD_HF1, telephony: CARD_HF1_TELEPHONY },
    'HF2': { rank: 22, card: CARD_HF2, telephony: CARD_HF2_TELEPHONY },
    'HF3': { rank: 23, card: CARD_HF3, telephony: CARD_HF3_TELEPHONY },
    'HF4': { rank: 24, card: CARD_HF4, telephony: CARD_HF4_TELEPHONY },
    'G1': { rank: 25, card: CARD_G1, telephony: CARD_G1_TELEPHONY },
    'G2': { rank: 26, card: CARD_G2, telephony: CARD_G2_TELEPHONY }
};

const SUGGESTION_CHIPS = [
    [{
        'type': 'chips',
        'options': [
            { 'text': 'Start screening' }, { 'text': 'What is covid-19?' },
            { 'text': 'What are the symptoms?' }, { 'text': 'How can I protect myself?' }
        ]
    }]
];

/**
 * Converts time to human a friendly format.
 */
function convertTimeFormat(hours, minutes) {
    var AmOrPm = hours >= 12 ? 'pm' : 'am';
    hours = (hours % 12) || 12;
    return hours + ':' + minutes + ' ' + AmOrPm;
}

/**
 * Gets the opening hours to fulfill the corresponding intent.
 */
function openHours(agent) {
    console.log(
        'openHours: agent.parameters = ' + JSON.stringify(agent.parameters));
    var organization = agent.parameters.organization;
    var geoCity = agent.parameters['geo-city'];
    if (!organization || !geoCity) {
        agent.add(`I didn't understand`);
        agent.add(`I'm sorry, can you try again?`);
        return;
    }

    var location = organization + ' ' + geoCity;
    const mapsClient = new MapsClient({});
    var name;
    return mapsClient
        .findPlaceFromText({
            params: {
                input: location,
                inputtype: 'textquery',
                fields: 'place_id,name',
                key: process.env.GOOGLE_MAPS_API_KEY
            },
            timeout: 5000 // milliseconds
        })
        .then(resp => {
            var candidates = resp.data.candidates;
            console.log('Candidates = ' + JSON.stringify(candidates));
            if (!candidates || !candidates.length) {
                return Promise.reject(
                    new Error('No candidates found for location: ' + location));
            }
            var placeId = (candidates[0] || {}).place_id;
            name = (candidates[0] || {}).name;
            if (!placeId) {
                return Promise.reject(
                    new Error('No place ID found for location: ' + location));
            }
            return mapsClient.placeDetails({
                params: {
                    place_id: placeId,
                    fields: 'opening_hours/periods,opening_hours/open_now',
                    key: process.env.GOOGLE_MAPS_API_KEY
                },
                timeout: 5000 // milliseconds
            });
        })
        .then(resp => {
            var result = resp.data.result;
            if (!result || !result.opening_hours) {
                return Promise.reject(
                    new Error('No opening hours found for location: ' + location));
            }
            var open_now = result.opening_hours.open_now;
            var now = new Date();
            var day = now.getDay();
            var periods = result.opening_hours.periods;
            if (open_now) {
                if (!periods[day] || !periods[day].close) {
                    return Promise.reject(
                        new Error('No close time found for location: ' + location));
                }
                var close_time = periods[day].close.time;
                var message = 'According to their website ' + name +
                    ' will remain open until ' +
                    convertTimeFormat(close_time.slice(0, 2), close_time.slice(2));
                agent.add(message);
            } else {
                var tomorrow = new Date();
                tomorrow.setDate(now.getDate() + 1);
                var tomorrowDay = tomorrow.getDay();
                var open_time = periods[tomorrowDay].open.time;
                var message = 'According to their website ' + name +
                    ' will remain closed until ' +
                    convertTimeFormat(open_time.slice(0, 2), open_time.slice(2));
                agent.add(message);
            }
        })
        .catch(e => {
            if (!!name) {
                agent.add(`I'm sorry, I can't find opening hours for ` + name);
            } else {
                agent.add(`I'm sorry, I can't find opening hours for ` + location);
            }
            console.log(e);
        });
}

/*
 * Queries the Covid-19 metrics dataset for a specific country.
 * Currently we only support country-wide metrics.
 * If you want to add search by other location types, you can look into
 * province_state field of bigquery-public-data.covid19_jhu_csse tables
 * for possible values. You can also find more detailed statistics for USA
 * in this dataset: bigquery-public-data.covid19_usafacts
 * You may also consider caching the result of this call since the data is
 * updated only once a day. You can read more about it here:
 * https://cloud.google.com/bigquery/docs/cached-results
 */
function queryCovid19dataset(tableName, country) {
    if (!['confirmed_cases', 'deaths', 'recovered_cases'].includes(tableName)) {
        return Promise.reject(new Error('Invalid table name ' + tableName));
    }
    // We convert some of the countries names to match those in the dataset.
    // Those countries are recognized by DialogFlow NLU but have different
    // naming conventions that are specific to the tables inside
    // bigquery-public-data.covid19_jhu_csse dataset.
    const countryNameCorrection = {
        'United States of America': 'US',
        'United States': 'US',
        'Cape Verde': 'Cabo Verde',
        'Democratic Republic of the Congo': 'Congo (Kinshasa)',
        'Republic of the Congo': 'Congo (Brazzaville)',
        'Côte d\'Ivoire': 'Cote d\'Ivoire',
        'Vatikan': 'Holy See',
        'South Korea': 'Korea, South',
        'Taiwan': 'Taiwan*',
    };
    if (Object.keys(countryNameCorrection).includes(country)) {
        country = countryNameCorrection[country];
    }
    var totalQuery = `SELECT *
    FROM bigquery-public-data.covid19_jhu_csse.` +
        tableName + `
    `;
    // If the country is specified, we will limit results to that country.
    if (country) {
        totalQuery += `
      WHERE country_region = @country
      `;
    }

    // Run the query.
    const bigqueryClient = new BigQuery();
    return bigqueryClient
        .query({
            query: totalQuery,
            // Include parameters that we specified in the query (@country).
            params: { country },
            location: 'US',
            timeout: 5000 // milliseconds
        })
        .then(resp => {
            const [rows] = resp;
            if (!rows || !rows.length) {
                return null;
            }
            // Sum all the values in the last column - the one with the latest data.
            return rows.map(r => r[Object.keys(r)[Object.keys(r).length - 1]])
                .reduce((a, b) => a + b, 0);
        });
}

/**
 * Gets the confirmed cases to fulfill the corresponding intent.
 */
function confirmedCases(agent) {
    console.log(
        'confirmedCases: agent.parameters = ' + JSON.stringify(agent.parameters));
    // Currently we only support country-wide metrics, but you can extend
    // this webhook to use other location parameters if you want.
    // See the comment in queryCovid19dataset function.
    var country = agent.parameters['geo-country'];
    var resultLocation = '';
    if (country) {
        resultLocation = 'in ' + country;
    } else {
        resultLocation = 'worldwide';
    }

    return queryCovid19dataset('confirmed_cases', country)
        .then(totalConfirmed => {
            if (totalConfirmed === null) {
                return Promise.reject(
                    new Error('No data found for confirmed cases ' + resultLocation));
            }

            var message = 'According to Johns Hopkins University, as of today, ' +
                'there are approximately ' + numberWithCommas(totalConfirmed) +
                ' confirmed cases of ' +
                'coronavirus ' + resultLocation + '.';
            console.log('response: ' + message);
            agent.add(message);
        })
        .catch(e => {
            agent.add(
                `I'm sorry, I can't find statistics for confirmed cases ` +
                resultLocation);
            console.log(e);
        });
}

/**
 * Gets the deaths to fulfill the corresponding intent.
 */
function death(agent) {
    console.log('death: agent.parameters = ' + JSON.stringify(agent.parameters));
    // Currently we only support country-wide metrics, but you can extend
    // this webhook to use other location parameters if you want.
    // See the comment in queryCovid19dataset function.
    var country = agent.parameters['geo-country'];
    var resultLocation = '';
    if (country) {
        resultLocation = 'in ' + country;
    } else {
        resultLocation = 'worldwide';
    }

    return queryCovid19dataset('deaths', country)
        .then(totalDeaths => {
            if (totalDeaths === null) {
                return Promise.reject(
                    new Error('No data found for deaths ' + resultLocation));
            }

            var message = 'According to Johns Hopkins University, as of today, ' +
                'approximately ' + numberWithCommas(totalDeaths) +
                ' people have died from coronavirus ' + resultLocation + '.';
            return queryCovid19dataset('confirmed_cases', country)
                .then(totalConfirmed => {
                    if (!!totalConfirmed) {
                        message += ' The death rate ' + resultLocation + ' is ' +
                            (totalDeaths / totalConfirmed * 100.0).toFixed(2) + '%';
                    }
                    console.log('response: ' + message);
                    agent.add(message);
                });
        })
        .catch(e => {
            agent.add(
                `I'm sorry, I can't find statistics for deaths ` + resultLocation);
            console.log(e);
        });
}

/**
 * convert number to a formatted number string.
 */
function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Adds label to agent context.
 */
function addLabelToContext(agent, label) {
    var label_ctx = agent.context.get('labels');
    if (!label_ctx || !label_ctx.parameters ||
        // Check for lifespan === 0 because we don't want to accidentally
        // refresh the lifespan of labels we're trying to delete.
        !label_ctx.parameters.labels || label_ctx.lifespan === 0) {
        agent.context.set({ name: 'labels', lifespan: 100, parameters: { labels: [label] } });
    } else {
        var labels = label_ctx.parameters.labels;
        if (!labels.includes(label)) {
            labels.push(label);
        }
        agent.context.set({ name: 'labels', lifespan: 100, parameters: { labels: labels } });
    }
}

/**
 * Adds a dummy payload when there's no other response so that the webhook
 * works in dialogflow-fulfillment:0.6.1.
 */
function addDummyPayload(agent) {
    agent.add('');
}

/**
 * Delete all currently existing contexts.
 * Calling "delete" on a context sets its lifespan to 0, so the deleted
 * context will remain on the agent object until the current webhook request
 * returns.
 */
function deleteAllContexts(agent) {
    const context_names = Object.keys(agent.context.contexts);
    context_names.forEach(name => agent.context.delete(name));
}

/**
 * Sets pronoun variables in a long lived context, then queues question q2-ill
 */
function handlePronounResponse(agent) {
    // We delete all contexts here so that any question-contexts leftover
    // from restarting the questionnaire don't cause us to skip questions
    // when invoking the 'trigger-question' event.
    deleteAllContexts(agent);

    let pronoun1;
    let pronoun2;
    let pronoun1_up;

    if (agent.intent === 'q1.pronouns_me') {
        pronoun1 = 'you';
        pronoun2 = 'your';
        pronoun1_up = 'You';
        addLabelToContext(agent, ME);
    } else if (agent.intent === 'q1.pronouns_they') {
        pronoun1 = 'they';
        pronoun2 = 'their';
        pronoun1_up = 'They';
        addLabelToContext(agent, SOMEONE_ELSE);
    } else {
        throw 'Could not match: ${agent.intent} to a pronoun response!';
    }
    const pronoun_params = {
        'pronoun1': pronoun1,
        'pronoun2': pronoun2,
        'pronoun1_up': pronoun1_up
    };
    agent.context.set(PRONOUNS, 100, pronoun_params);
    agent.context.set(Q2, 5);
    agent.context.delete(Q1);

    agent.setFollowupEvent('trigger-question');
    addDummyPayload(agent);
}

/**
 * Generates cards with the user's pronoun selections based on card templates.
 */
function substitutePronounsForCard(agent, card) {
    // Cards ready for the Virtual Agent are wrapped with an array.
    const newTitle = substitutePronounsForString(agent, card[0]['title']);
    const newText = substitutePronounsForString(agent, card[0]['text']);
    const newCard = {
        'title': newTitle,
        'text': newText,
        'type': card[0]['type']
    };
    return [newCard];
}

/**
 * Generate text with the user's pronoun selections.
 */
function substitutePronounsForString(agent, text) {
    const pronoun_context = agent.context.get('pronouns');
    const pronoun1 = pronoun_context.parameters.pronoun1;
    const pronoun1_up = pronoun_context.parameters.pronoun1_up;
    const pronoun2 = pronoun_context.parameters.pronoun2;

    // Cards ready for the Virtual Agent are wrapped with an array.
    return text.replace(new RegExp(PRONOUN1, 'g'), pronoun1)
        .replace(new RegExp(PRONOUN2, 'g'), pronoun2)
        .replace(new RegExp(PRONOUN1_UP, 'g'), pronoun1_up);
}

/**
 * Determines the previous question's context
 */
function getPreviousQuestionCtx(agent) {
    // Question contexts are named: "q{ID}...". Only one should ever be active.
    const context_names = Object.keys(agent.context.contexts);
    const question_contexts = context_names.filter(ctx => ctx.match(/\bq\d+/));
    if (question_contexts.length !== 1) {
        throw `Did not find exactly one question context. Found: ${question_contexts} instead`;
    }
    return question_contexts[0];
}

/**
 * Determines the next question's context based on current context and intent.
 */
function getNextQuestionCtx(agent) {
    const prevQuestion = getPreviousQuestionCtx(agent);
    if (prevQuestion === Q2) {
        if (agent.intent === YES_INTENT) {
            const for_self = agent.context.get('labels').parameters.labels.includes(ME);
            if (for_self) {
                return Q5;
            } else {
                return Q3;
            }
        } else {
            return END;
        }
    } else {
        return QUESTION_FLOW_MAP[prevQuestion][agent.intent];
    }
}

/**
 * Generic handler for all yes/no questions within the questionnaire.
 *
 * Determines which question was just asked and updates labels accordingly,
 * then triggers next question or final results.
 */
function handleAnswer(agent) {
    const question_ctx = getPreviousQuestionCtx(agent);
    const labels = QUESTION_ANSWER_LABEL_MAP[question_ctx][agent.intent];
    labels.forEach(label => addLabelToContext(agent, label));
    const next_question_ctx = getNextQuestionCtx(agent);
    agent.context.delete(question_ctx);
    agent.context.set(next_question_ctx, 5);

    agent.setFollowupEvent('trigger-question');
    addDummyPayload(agent);
}

/**
 * Determines the appropriate care message card for the user given all labels.
 */
function getCareMessageCard(labels) {
    if (labels.includes(NOT_ILL)) {
        return 'CMA';
    }
    if (labels.includes(EXTREME)) {
        return 'CMB';
    }
    if (labels.includes(SEVERE_EXTREME)) {
        return 'CMI';
    }
    if (labels.includes(INFANT)) {
        return 'CMC';
    }
    if (labels.includes(SEVERE)) {
        return 'CMD';
    }
    if (labels.includes(SHORT_OF_BREATH) || (labels.includes(FEVER) && labels.includes(HEALTHRISK)) || (labels.includes(COUGH) && labels.includes(HEALTHRISK))) {
        return 'CME';
    }
    if (labels.includes(HCP) && labels.includes(SYMPTOMATIC)) {
        return 'CMF';
    }
    if (labels.includes(LTC) && labels.includes(SYMPTOMATIC)) {
        return 'CMG';
    }
    if (!labels.includes(LTC) && !labels.includes(HCP) && labels.includes(SYMPTOMATIC)) {
        return 'CMH';
    }
    return NO_CARE_MESSAGE;
}

/**
 * Given the labels in the current context, decides which cards to
 * suggest to users.
 */
function actionMapper(agent) {
    var labels = [];
    var label_ctx = agent.context.get('labels');
    if (label_ctx && label_ctx.parameters && label_ctx.parameters.labels) {
        labels = label_ctx.parameters.labels;
    }
    if (!labels.filter(l => [ME, SOMEONE_ELSE].includes(l)).length) {
        console.log('No labels to suggest actions');
    }

    if (!agent.requestSource) {
        // Set a special source to enable rich responses.
        agent.requestSource = 'DIALOGFLOW_MESSENGER';
    }

    let cards = [];
    const care_message_card = getCareMessageCard(labels);
    if (care_message_card !== NO_CARE_MESSAGE) {
        cards.push(care_message_card);
    }
    cards = cards.concat(CARE_MESSAGE_TO_ACTION_CARDS[care_message_card]);
    if (!EMERGENCY_CARDS.includes(care_message_card)) {
        cards = cards.concat(CARDS_ALL);
        labels.forEach(label => {
            if (label in LABEL_CARD_MAP) {
                cards = cards.concat(LABEL_CARD_MAP[label]);
            }
        });
    }

    /* Collect cards for both telephony and rich responses when either platform
     * is used, in order to produce errors on both platforms in the event that
     * any card is not configured for both platforms. */
    var cards_to_render =
        Array.from(new Set(cards))
        .sort(function(a, b) {
            // In the chatbot, more important cards should be at the bottom.
            return CARDS_REGISTRY[b].rank - CARDS_REGISTRY[a].rank;
        })
        .map(function(a) {
            return substitutePronounsForCard(agent, CARDS_REGISTRY[a].card);
        });
    const telephony_cards =
        Array.from(new Set(cards))
        .sort(function(a, b) {
            // In the phone bot, more important cards should be said first.
            return CARDS_REGISTRY[a].rank - CARDS_REGISTRY[b].rank;
        })
        .map(function(a) {
            return substitutePronounsForString(agent, CARDS_REGISTRY[a].telephony);
        });

    const telephony_text = telephony_cards.join(' ');
    if (agent.requestSource !== 'GOOGLE_TELEPHONY') {
        agent.add(new Payload(agent.UNSPECIFIED, { richContent: cards_to_render }, { sendAsMessage: true, rawPayload: true }));
    } else {
        agent.add(telephony_text);
    }

    // Clear context.
    agent.context.delete('labels');
    agent.context.delete(PRONOUNS);
}

exports.dialogflowFirebaseFulfillment =
    functions.https.onRequest((request, response) => {
        if (!!request.body.queryResult.fulfillmentMessages) {
            request.body.queryResult.fulfillmentMessages =
                request.body.queryResult.fulfillmentMessages.map(m => {
                    if (!m.platform) {
                        // Set the platform to UNSPECIFIED instead of null.
                        m.platform = 'PLATFORM_UNSPECIFIED';
                    }
                    return m;
                });
        }

        const agent = new WebhookClient({ request, response });
        console.log(
            'Dialogflow Request headers: ' + JSON.stringify(request.headers));
        console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

        // Register function handlers based on the matched Dialogflow intent name.
        let intentMap = new Map();
        intentMap.set('q1.pronouns_me', handlePronounResponse);
        intentMap.set('q1.pronouns_they', handlePronounResponse);
        intentMap.set('q.yes', handleAnswer);
        intentMap.set('q.no', handleAnswer);
        intentMap.set('coronavirus.closure', openHours);
        intentMap.set('coronavirus.confirmed_cases', confirmedCases);
        intentMap.set('coronavirus.death', death);
        intentMap.set('end', actionMapper);
        agent.handleRequest(intentMap);
    });