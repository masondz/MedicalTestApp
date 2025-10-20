//Need to separate patients by assessment and data quality:
// high_risk_patients: string[], fever_patients: string[], data_quality_issues: string[];

//First, make data model
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
async function fetchPatientData(): Promise<Patient[]> {
  const response = await fetch(
    "https://assessment.ksensetech.com/api/patients?page=1&limit=10",
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "ak_5f8478cac08561fbd4cefe026d93a13147ccbb5742f057c8",
      },
    }
  );
  const patients: Patient[] = await response.json().then((data) => data.data);
  return patients;
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

function assessBloodPressure(
  patientId: string,
  bp: string | null | undefined
): number | BadData {
  if (bp == null) {
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
function assessFever(temperature: number): number | BadData {
  if (temperature == null || isNaN(temperature)) {
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

//function to check data quality

async function main() {
  //TODO uncomment after testing
  // let patients: Patient[] = await fetchPatientData();

  //TODO: remove this if statement after testing
  let patients: Patient[] = [
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
  ];

  if (!patients || patients.length === 0 || !patients[0]) {
    console.log("No patient data found.");
    return;
  }
  console.log("Blood pressure of first patient:", patients[0]?.blood_pressure);
  console.log(
    "Assessment of first patient:",
    assessBloodPressure(patients[0].patient_id, patients[0]?.blood_pressure)
  );

  console.log(
    "Fever of first patient:",
    patients[0]?.temperature,
    assessFever(patients[0].temperature)
  );
}

main().catch(console.error);
