//Define patient interface
interface Patient {
  patient_id: string; //this is what will be passed to arrays
  name: string; //"Lastname, Firstname"
  age: number;
  gender: string;
  blood_pressure: string; //e.g. "120/80"
  temperature: number;
  visit_date: Date;
  diagnosis: string;
  medications: string;
}

type BadData = "bad_data";

//function to fetch patient data from database
async function fetchPatientData(
  maxRetries = 3,
  page: number,
  limit = 20
): Promise<Patient[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(
        `https://assessment.ksensetech.com/api/patients?page=${page}&limit=${limit}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "ak_5f8478cac08561fbd4cefe026d93a13147ccbb5742f057c8",
          },
        }
      );
      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status} - ${response.statusText}`
        );
      }
      const patients: Patient[] = await response
        .json()
        .then((data) => data.data);

      if (patients.length === 0) {
        console.log("No patient data found.");
      } else {
        console.log(`Fetched ${patients.length} patients successfully.`);
      }
      return patients;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries - 1) {
        throw new Error(
          `Failed after ${maxRetries} attempts: ${lastError.message}`
        );
      }

      console.error(
        `Attempt ${attempt} to fetch patient data failed:`,
        lastError.message
      );

      const waitTime = Math.pow(2, attempt) * 1000;
      console.warn(
        `Attempt ${attempt + 1} failed. Retrying in ${waitTime}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
  throw (
    lastError || new Error("Failed to fetch patient data after all retries")
  );
}

//Function to navigate api pages until no more data is returned
async function navigateApiPages(maxRetries: number): Promise<Patient[]> {
  let allPatients: Patient[] = [];
  let page = 1;
  let limit = 20;
  while (true) {
    const patients = await fetchPatientData(maxRetries, page, limit);
    if (patients.length === 0) {
      break;
    }
    allPatients.push(...patients);
    if (patients.length < limit) {
      break;
    }
    page++;
  }
  return allPatients;
}

//function to assess bp level
enum BloodPressureRisk {
  normal = 0,
  elevated = 1,
  stageOne = 2,
  stageTwo = 3,
}

function assessBloodPressure(bp: string | null | undefined): number | BadData {
  if (bp == null || typeof bp !== "string") {
    return "bad_data";
  }
  const [systolicStr, diastolicStr] = bp.split("/");

  if (!systolicStr || !diastolicStr) {
    return "bad_data";
  }

  const systolic = parseInt(systolicStr, 10);
  const diastolic = parseInt(diastolicStr, 10);

  if (isNaN(systolic) || isNaN(diastolic)) {
    return "bad_data";
  }

  const systolicRisk = determineSystolicRisk(systolic);
  const diastolicRisk = determineDiastolicRisk(diastolic);

  return Math.max(systolicRisk, diastolicRisk);
}

const determineSystolicRisk = (systolic: number): number => {
  let riskLevel = 0;
  switch (true) {
    case systolic < 120:
      riskLevel = BloodPressureRisk.normal;
      break;
    case systolic >= 120 && systolic < 130:
      riskLevel = BloodPressureRisk.elevated;
      break;
    case systolic >= 130 && systolic < 140:
      riskLevel = BloodPressureRisk.stageOne;
      break;
    case systolic >= 140:
      riskLevel = BloodPressureRisk.stageTwo;
      break;
    default:
      riskLevel = 0;
  }
  return riskLevel;
};

const determineDiastolicRisk = (diastolic: number): number => {
  let riskLevel = 0;
  switch (true) {
    case diastolic < 80:
      riskLevel = BloodPressureRisk.normal;
      break;
    case diastolic >= 80 && diastolic < 90:
      riskLevel = BloodPressureRisk.stageOne;
      break;
    case diastolic >= 90:
      riskLevel = BloodPressureRisk.stageTwo;
      break;
    default:
      riskLevel = 0;
  }
  return riskLevel;
};

//function to assess fever
enum FeverRisk {
  normal = 0,
  lowFever = 1,
  highFever = 2,
}

function assessFever(temperature: number | null | undefined): number | BadData {
  if (
    temperature == null ||
    isNaN(temperature) ||
    typeof temperature === "boolean"
  ) {
    return "bad_data";
  }

  switch (true) {
    case temperature <= 99.5:
      return FeverRisk.normal;
    case temperature >= 99.6 && temperature <= 100.9:
      return FeverRisk.lowFever;
    default:
      return FeverRisk.highFever;
  }
}

//function to assess age risk
enum AgeRisk {
  underForty = 0,
  fortyToSixtyFive = 1,
  overSixtyFive = 2,
}

function assessAgeRisk(age: number | null | undefined): number | BadData {
  if (age == null || isNaN(age) || typeof age === "boolean") {
    return "bad_data";
  }

  switch (true) {
    case age < 40:
      return AgeRisk.underForty;
    case age >= 40 && age <= 65:
      return AgeRisk.fortyToSixtyFive;
    default:
      return AgeRisk.overSixtyFive;
  }
}

const combineRisks = (...risks: (number | BadData)[]): number => {
  return risks.reduce(
    (sum: number, risk) => (typeof risk === "number" ? sum + risk : sum),
    0
  );
};

async function main() {
  //TODO: try looking at all of patients data before fixing
  let patients: Patient[] = await navigateApiPages(5);

  const high_risk_patients: string[] = [];
  const fever_patients: string[] = [];
  const data_quality_issues: string[] = [];

  if (!patients || patients.length === 0 || !patients[0]) {
    console.log("No patient data found.");
    return;
  }

  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i];
    if (!patient) continue;

    let patientBpRisk = assessBloodPressure(patient.blood_pressure);
    let patientFeverRisk = assessFever(patient.temperature);
    let patientAgeRisk = assessAgeRisk(patient.age);

    if (
      (patientBpRisk === "bad_data" ||
        patientFeverRisk === "bad_data" ||
        patientAgeRisk === "bad_data") &&
      !data_quality_issues.includes(patient.patient_id)
    ) {
      data_quality_issues.push(patient.patient_id);
    }

    let patientRiskScore = combineRisks(
      patientBpRisk,
      patientFeverRisk,
      patientAgeRisk
    );

    if (
      typeof patientRiskScore === "number" &&
      patientRiskScore >= 4 &&
      !high_risk_patients.includes(patient.patient_id)
    ) {
      high_risk_patients.push(patient.patient_id);
    }

    if (
      (patientFeverRisk as number) >= FeverRisk.lowFever &&
      !fever_patients.includes(patient.patient_id)
    ) {
      fever_patients.push(patient.patient_id);
    }
  }

  console.log("Showing sorted patient data:");
  console.log(
    `High Risk Patients (${high_risk_patients.length}):`,
    high_risk_patients
  );
  console.log(`Fever Patients (${fever_patients.length}):`, fever_patients);
  console.log(
    `Data Quality Issues (${data_quality_issues.length}):`,
    data_quality_issues
  );
  console.log("Total Patients Processed:", patients.length);

  console.log("Attempting to POST results...");

  const results = {
    high_risk_patients: high_risk_patients,
    fever_patients: fever_patients,
    data_quality_issues: data_quality_issues,
  };

  try {
    const response = await fetch(
      "https://assessment.ksensetech.com/api/submit-assessment",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "ak_5f8478cac08561fbd4cefe026d93a13147ccbb5742f057c8",
        },
        body: JSON.stringify(results),
      }
    ).then((response) => response.json());

    console.log("Assessment Results:", response);
    console.log("Feedback Strengths:", response.results.feedback.strengths);
    console.log("Feedback issues:", response.results.feedback.issues);
  } catch (error) {
    console.error("Error POSTing results:", error);
  }
}

main().catch(console.error);
