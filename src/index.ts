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
  const patients: Patient[] = await response.json();
  return patients;
}

//function to assess bp level
/*
function assessBloodPressure(patientId: string, bp: string): number {
  const [systolicStr, diastolicStr] = bp.split("/");
  const systolic = parseInt(systolicStr, 10);
  const diastolic = parseInt(diastolicStr, 10);

  //change this later
  if (systolic > 140 || diastolic > 90) {
    return 1; // High blood pressure
  }
  return 0; // Normal blood pressure
}*/

//function to assess fever

//function to check data quality

async function main() {
  let patients: Patient[] = await fetchPatientData();
  console.log(patients);
}

main().catch(console.error);
