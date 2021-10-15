const express = require("express");
const bodyParser = require("body-parser");
const { wordsToNumbers } = require("words-to-numbers");
require("dotenv").config();

// ... app code here
// Import the appropriate service and chosen wrappers
const { conversation } = require("@assistant/conversation");
// const functions = require('firebase-functions');
const admin = require("firebase-admin");

admin.initializeApp({
	credential: admin.credential.applicationDefault(),
	databaseURL: "https://voice-charting-2-default-rtdb.firebaseio.com",
});
const database = admin.firestore();
// Create an app instance
const app = conversation();

// Register handlers for Actions SDK

const numToString = (num) => {
	if (typeof num == "number") {
		return String(num);
	} else {
		return num.join("");
	}
};
//to speed up testing
let employeeIdNumber = "1234",
	pin = "5678",
	firstName = "Andrew",
	roomNumber;

const logIn = async (conv) => {
	//sometimes google thinks pin and id number is an array, sometime it thinks its just a number
	employeeIdNumber = numToString(conv.session.params.employeeIdNumber);
	pin = numToString(conv.session.params.pin);
	console.log("This is employeeIdNumber");
	console.log(employeeIdNumber);

	await database
		.collection("Employees")
		.where("employeeIdNumber", "==", `${employeeIdNumber}`)
		.get()
		.then((employees) => {
			if (employees.docs[0] && employees.docs[0].data().pin == pin) {
				firstName = employees.docs[0].data().firstName;
				conv.scene.next.name = "start";
			} else {
				conv.add("Wrong ID pin combination. ");
				conv.scene.next.name = "employeeIdNumber";
			}
		});
};

const start = (conv) => {
	//   if it's the first time logging in for the session
	let firstGreeting = "";

	if (pin) {
		pin = null;
		firstGreeting = `Hello ${firstName}.`;
	}
	conv.add(
		firstGreeting +
			"Would you like to create a record, get a record, or get tips about a patient?"
	);
};

// can't have a roomNumber 2 because google translates it as 'to'
const roomVerification = async (conv) => {
	roomNumber = numToString(conv.session.params.roomNumber);
	return await database
		.collection("Patients")
		.where("roomNumber", "==", roomNumber)
		.get()
		.then((patients) => {
			if (!patients.docs[0]) {
				conv.add("I couldn't find that room number. ");
				conv.scene.next.name = conv.scene.name;
				return false;
			} else return patients.docs[0].data();
		});
};

const recordMealConsumption = async (conv) => {
	await roomVerification(conv).then(async (patient) => {
		if (patient) {
			await database.collection("ActivityLog").add({
				employeeIdNumber: employeeIdNumber,
				firstName: patient.firstName,
				lastName: patient.lastName,
				roomNumber: patient.roomNumber,
				timeStamp: Date.now(),
				amountEaten: numToString(conv.session.params.amountEaten),
			});
			conv.add(
				`Okay, I recorded that ${patient.firstName} ${patient.lastName} ate ${conv.session.params.amountEaten} out of 10 of their meal. `
			);
			conv.scene.next.name = "start";
		}
	});
};

const noMatch = (conv) => {
	conv.add("Sorry, can you repeat that?");
	conv.scene.next.name = conv.scene.name;
};

const repeat = (conv) => {
	conv.scene.next.name = conv.scene.name;
};
const createToiletingRecord = async (conv) => {
	await roomVerification(conv).then(async (patient) => {
		if (patient) {
			await database.collection("ActivityLog").add({
				employeeIdNumber: conv.session.params.employeeIdNumber,
				firstName: patient.firstName,
				lastName: patient.lastName,
				roomNumber: patient.roomNumber,
				timeStamp: Date.now(),
				// bowel: conv.session.params.bowel,
				// continentIncontinent: conv.session.params.continentIncontinent == ,
				// stoolConsistency: conv.session.params.stoolConsistency,
				isIncontinent: conv.session.params.isIncontinent,
			});
			await conv.add(`Okay, I recorded that ${patient.firstName} ${
				patient.lastName
			} was ${conv.session.params.isIncontinent ? "incontinent" : "continent"} 
      	in the bowel. `);
			conv.scene.next.name = "start";
		}
	});
};

// gets activity of a person, not working right now
const activityLog = async (conv) => {
	let response = "";
	let hasActivityLog = false;
	await database
		.collection("ActivityLog")
		.where("", "==", `${conv.session.params.person}`)
		.orderBy("timeStamp")
		.get()
		.then((activityLog) => {
			activityLog.docs.forEach((doc) => {
				hasActivityLog = true;
				if (doc.data().bowel) {
					response += `${timeDifference(Date.now(), doc.data().timeStamp)}, ${
						doc.data().person
					} was 
          ${doc.data().continentIncontinent} in the bowel and it was ${
						doc.data().stoolConsistency
					}. `;
				} else if (doc.data().meal) {
					response += `${timeDifference(Date.now(), doc.data().timeStamp)}, ${
						doc.data().person
					} ate 
          ${doc.data().amountEaten} of his ${doc.data().meal}. `;
				}
			});
		});
	if (hasActivityLog) {
		await conv.add(response);
	} else {
		await conv.add(`${conv.session.params.person} has no records. `);
	}
};

// given two timeStamps, returns how much time ago the earlier time was from the latter time
function timeDifference(current, previous) {
	var msPerMinute = 60 * 1000;
	var msPerHour = msPerMinute * 60;
	var msPerDay = msPerHour * 24;
	var msPerMonth = msPerDay * 30;
	var msPerYear = msPerDay * 365;

	var elapsed = current - previous;

	if (elapsed < msPerMinute) {
		return Math.round(elapsed / 1000) + " seconds ago";
	} else if (elapsed < msPerHour) {
		return Math.round(elapsed / msPerMinute) + " minutes ago";
	} else if (elapsed < msPerDay) {
		return Math.round(elapsed / msPerHour) + " hours ago";
	} else if (elapsed < msPerMonth) {
		return Math.round(elapsed / msPerDay) + " days ago";
	} else if (elapsed < msPerYear) {
		return Math.round(elapsed / msPerMonth) + " months ago";
	} else {
		return Math.round(elapsed / msPerYear) + " years ago";
	}
}

const whenEat = async (conv) => {
	await roomVerification(conv).then(async (patient) => {
		if (patient) {
			await database
				.collection("ActivityLog")
				.where("roomNumber", "==", `${patient.roomNumber}`)
				.where("hasMeal", "==", true)
				.orderBy("timeStamp", "desc")
				.get()
				.then((activityLog) => {
					if (activityLog.docs[0]) {
						conv.add(
							`${patient.firstName} had ${
								activityLog.docs[0].data().meal
							} ${timeDifference(
								Date.now(),
								activityLog.docs[0].data().timeStamp
							)}. `
						);
					} else {
						conv.add(`${patient.firstName} has no records. `);
					}
				});
			conv.scene.next.name = "start";
		}
	});
};

const whenBowel = async (conv) => {
	await roomVerification(conv).then(async (patient) => {
		if (patient) {
			await database
				.collection("ActivityLog")
				.where("roomNumber", "==", `${patient.roomNumber}`)
				.where("bowel", "==", "bowel")
				.orderBy("timeStamp", "desc")
				.get()
				.then((activityLog) => {
					if (activityLog.docs[0]) {
						conv.add(`${patient.firstName} had a ${
							activityLog.docs[0].data().stoolConsistency
						}, ${
							activityLog.docs[0].data().continentIncontinent
						} bowel movement 
                      ${timeDifference(
												Date.now(),
												activityLog.docs[0].data().timeStamp
											)}. `);
					} else {
						conv.add(`${patient.firstName} has no records. `);
					}
				});
			conv.scene.next.name = "start";
		}
	});
};

const tipsTransferring = async (conv) => {
	await roomVerification(conv).then(async (patient) => {
		if (patient) {
			await database
				.collection("Patients")
				.where("roomNumber", "==", `${patient.roomNumber}`)
				.get()
				.then((patient) => {
					if (patient.docs[0].data().transferring) {
						conv.add(patient.docs[0].data().transferring);
						//                       	 conv.add("very good");
					} else {
						conv.add(`${patient.firstName} has no transferring tips. `);
					}
				});
			conv.scene.next.name = "start";
		}
	});
};

// app.handle('employeeIdNumber', employeeIdNumber);
app.handle("logIn", logIn);
app.handle("start", start);
app.handle("recordMealConsumption", recordMealConsumption);
app.handle("createToiletingRecord", createToiletingRecord);
// app.handle('activityLog', activityLog);
app.handle("whenEat", whenEat);
app.handle("noMatch", noMatch);
app.handle("repeat", repeat);
app.handle("whenBowel", whenBowel);
app.handle("tipsTransferring", tipsTransferring);

const expressApp = express().use(bodyParser.json());
expressApp.post("/", app);
expressApp.listen(3300, () => {
	`now listening to 3300`;
});
