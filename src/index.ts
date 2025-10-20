//Need to separate patients by assessment and data quality:
// high_risk_patients: string[], fever_patients: string[], data_quality_issues: string[];

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

const bloodPressureRisk = {
  normal: 0,
  elevated: 1,
  stageOne: 2,
  stageTwo: 3,
};

//function to fetch patient data from database
async function fetchPatientData(maxRetries = 3): Promise<Patient[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(
        "https://assessment.ksensetech.com/api/patients?page=1&limit=20",
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
      console.log(`Fetched ${patients.length} patients successfully.`);
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

const determineSystolicRisk = (systolic: number): number => {
  let riskLevel = 0;
  switch (true) {
    case systolic < 120:
      riskLevel = bloodPressureRisk.normal;
      break;
    case systolic >= 120 && systolic < 130:
      riskLevel = bloodPressureRisk.elevated;
      break;
    case systolic >= 130 && systolic < 140:
      riskLevel = bloodPressureRisk.stageOne;
      break;
    case systolic >= 140:
      riskLevel = bloodPressureRisk.stageTwo;
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
      riskLevel = bloodPressureRisk.normal;
      break;
    case diastolic >= 80 && diastolic < 90:
      riskLevel = bloodPressureRisk.stageOne;
      break;
    case diastolic >= 90:
      riskLevel = bloodPressureRisk.stageTwo;
      break;
    default:
      riskLevel = 0;
  }
  return riskLevel;
};

type BadData = "bad_data";

//function to assess bp level

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

const feverRisk = {
  normal: 0,
  lowFever: 1,
  highFever: 2,
};

//function to assess fever
function assessFever(temperature: number | null | undefined): number | BadData {
  //does not catch booleans
  if (
    temperature == null ||
    isNaN(temperature) ||
    typeof temperature === "boolean"
  ) {
    return "bad_data";
  }

  switch (true) {
    case temperature <= 99.5:
      return feverRisk.normal;
    case temperature >= 99.6 && temperature <= 100.9:
      return feverRisk.lowFever;
    default:
      return feverRisk.highFever;
  }
}

//function to assess age risk
const ageRisk = {
  underForty: 0,
  fortyToSixtyFive: 1,
  overSixtyFive: 2,
};

function assessAgeRisk(age: number | null | undefined): number | BadData {
  if (age == null || isNaN(age) || typeof age === "boolean") {
    return "bad_data";
  }

  switch (true) {
    case age < 40:
      return ageRisk.underForty;
    case age >= 40 && age <= 65:
      return ageRisk.fortyToSixtyFive;
    default:
      return ageRisk.overSixtyFive;
  }
}

const combineRisks = (bpRisk: number, feverRisk: number, ageRisk: number) =>
  bpRisk + feverRisk + ageRisk;

async function main() {
  //TODO uncomment after testing
  let patients: Patient[] = await fetchPatientData();

  const high_risk_patients: string[] = [];
  const fever_patients: string[] = [];
  const data_quality_issues: string[] = [];

  //TODO: remove this if statement after testing
  /*let patients: Patient[] = [
    {
      patient_id: "test123",
      name: "Doe, John",
      age: 45,
      gender: "Male",
      blood_pressure: "121/79",
      temperature: 98.6,
      visit_date: new Date("2023-04-01"),
      diagnosis: "Hypertension",
      medications: "Lisinopril 10mg daily",
    },
    {
      patient_id: "test456",
      name: "Smith, Jane",
      age: 70,
      gender: "Female",
      blood_pressure: "130/85",
      temperature: 101.2,
      visit_date: new Date("2023-04-02"),
      diagnosis: "Influenza",
      medications: "Acetaminophen 650mg every 6 hours as needed",
    },
  ];*/

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
      continue;
    }

    let patientRiskScore = combineRisks(
      patientBpRisk as number,
      patientFeverRisk as number,
      patientAgeRisk as number
    );

    if (
      patientRiskScore >= 4 &&
      !high_risk_patients.includes(patient.patient_id)
    ) {
      high_risk_patients.push(patient.patient_id);
    }

    if (
      (patientFeverRisk as number) >= feverRisk.lowFever &&
      !fever_patients.includes(patient.patient_id)
    ) {
      fever_patients.push(patient.patient_id);
    }
  }

  if (!patients || patients.length === 0 || !patients[0]) {
    console.log("No patient data found.");
    return;
  }
  console.log("High Risk Patients:", high_risk_patients);
  console.log("Fever Patients:", fever_patients);
  console.log("Data Quality Issues:", data_quality_issues);
}

main().catch(console.error);
