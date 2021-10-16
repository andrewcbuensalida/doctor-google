const express = require("express");
const bodyParser = require("body-parser");
// const { wordsToNumbers } = require("words-to-numbers");
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
let employeeIdNumber, pin, firstName, roomNumber;

const signup = async (conv) => {
	//sometimes google thinks pin and id number is an array, sometime it thinks its just a number
	employeeIdNumber = numToString(conv.session.params.employeeIdNumber);
	pin = numToString(conv.session.params.pin);
	firstName = conv.session.params.firstName;
	let employee = await database
		.collection("Employees")
		.where("employeeIdNumber", "==", `${employeeIdNumber}`)
		.limit(1)
		.get();

	if (employee.docs[0]) {
		conv.add("That ID number already exists. ");
		conv.scene.next.name = "loginOrSignup";
	} else {
		database.collection("Employees").add({
			employeeIdNumber: employeeIdNumber,
			pin: pin,
			timeStamp: Date.now(),
			firstName: firstName,
		});

		conv.add(
			`Okay ${firstName}, your ID number is ${employeeIdNumber} and your pin number is ${pin}. `
		);
		conv.scene.next.name = "start";
	}
};

const logIn = async (conv) => {
	//sometimes google thinks pin and id number is an array, sometime it thinks its just a number
	employeeIdNumber = numToString(conv.session.params.employeeIdNumber);
	pin = numToString(conv.session.params.pin);

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
				conv.scene.next.name = "login";
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
			"Would you like to create an entry, get records, or get tips about a patient?"
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
				conv.scene.next.name = conv.scene.name;
				conv.add("I couldn't find that room number. ");
			} else {
				return patients.docs[0].data();
			}
		});
};

const createEatingRecord = async (conv) => {
	await roomVerification(conv).then((patient) => {
		if (patient) {
			database.collection("ActivityLog").add({
				employeeIdNumber: employeeIdNumber,
				roomNumber: patient.roomNumber,
				timeStamp: Date.now(),
				amountEaten: conv.session.params.amountEaten,
				isEatRecord: true,
			});
			conv.add(
				`Okay, I recorded that ${patient.firstName} ${patient.lastName} ate ${conv.session.params.amountEaten} of their food. `
			);
			conv.scene.next.name = "start";
		}
	});
};

const noMatch = (conv) => {
	conv.add("Pardon me, but can you say that in a different way?");
	conv.scene.next.name = conv.scene.name;
};

const sayAgain = (conv) => {
	conv.scene.next.name = conv.scene.name;
};
const createBriefChangeRecord = async (conv) => {
	const patient = await roomVerification(conv);
	if (patient) {
		database.collection("ActivityLog").add({
			employeeIdNumber: employeeIdNumber,
			roomNumber: patient.roomNumber,
			timeStamp: Date.now(),
			isBriefChangeRecord: true,
			firstName: patient.firstName,
			lastName: patient.lastName,
		});
		conv.add(
			`Okay, I recorded that ${patient.firstName} ${patient.lastName} had a brief change. `
		);
		conv.scene.next.name = "start";
	}
};

// gets activity of a person, not working right now
const getPendingBriefChanges = async (conv) => {
	const oldestBriefChanges = await database
		.collection("ActivityLog")
		.where("isBriefChangeRecord", "==", true)
		.orderBy("timeStamp")
		.limit(3)
		.get();

	if (oldestBriefChanges.docs.length > 0) {
		let response = "";
		oldestBriefChanges.docs.forEach((briefChange) => {
			response += `${briefChange.data().firstName} ${
				briefChange.data().lastName
			} had a brief change ${timeDifference(
				Date.now(),
				briefChange.data().timeStamp
			)}. `;
		});
		conv.add(response);
	} else {
		conv.add(`There are no pending brief changes. `);
	}
	conv.scene.next.name = "start";
};

const getTopPerformers = async (conv) => {
	const briefChanges = await database
		.collection("ActivityLog")
		.where("isBriefChangeRecord", "==", true)
		.where("timeStamp", ">", Date.now() - 1000 * 60 * 60 * 8)
		.get();

	if (briefChanges.docs.length > 0) {
		let response = "";
		let map = new Map();
		briefChanges.docs.forEach((briefChange) => {
			if (map.has(briefChange.data().employeeIdNumber)) {
				map.set(
					briefChange.data().employeeIdNumber,
					Number(map.get(briefChange.data().employeeIdNumber)) + 1
				);
			} else {
				map.set(briefChange.data().employeeIdNumber, 1);
			}
		});

		const mapSort1 = [...map.entries()].sort((a, b) => b[1] - a[1]);
		await Promise.all(
			mapSort1.map(async (idAndCount) => {
				const employee = await database
					.collection("Employees")
					.where("employeeIdNumber", "==", idAndCount[0])
					.get();

				response += `${employee.docs[0].data().firstName} did ${
					idAndCount[1]
				} brief change${idAndCount[1] == 1 ? "" : "s"}, `;
			})
		);
		response += "in the last 8 hours. ";
		conv.add(response);
	} else {
		conv.add(`There are no records. `);
	}
	conv.scene.next.name = "start";
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

const getEatRecord = async (conv) => {
	const patient = await roomVerification(conv);
	if (patient) {
		const activityLog = await database
			.collection("ActivityLog")
			.where("roomNumber", "==", `${patient.roomNumber}`)
			.where("isEatRecord", "==", true)
			.orderBy("timeStamp", "desc")
			.limit(1)
			.get();
		if (activityLog.docs[0]) {
			conv.add(
				`${patient.firstName} ate ${
					activityLog.docs[0].amountEaten
				} of their food ${timeDifference(
					Date.now(),
					activityLog.docs[0].data().timeStamp
				)}. `
			);
		} else {
			conv.add(`${patient.firstName} has no eating records. `);
		}
		conv.scene.next.name = "start";
	}
};

const getTransferringTips = async (conv) => {
	await roomVerification(conv).then(async (patient) => {
		if (patient) {
			await database
				.collection("Patients")
				.where("roomNumber", "==", `${patient.roomNumber}`)
				.get()
				.then((patient) => {
					if (patient.docs[0].data().transferring) {
						conv.add(patient.docs[0].data().transferring);
					} else {
						conv.add(
							`${patient.firstName} has no transferring tips. `
						);
					}
				});
			conv.scene.next.name = "start";
		}
	});
};

app.handle("logIn", logIn);
app.handle("signup", signup);
app.handle("start", start);
app.handle("createEatingRecord", createEatingRecord);
app.handle("createBriefChangeRecord", createBriefChangeRecord);
app.handle("getTopPerformers", getTopPerformers);
app.handle("getPendingBriefChanges", getPendingBriefChanges);
app.handle("getEatRecord", getEatRecord);
app.handle("noMatch", noMatch);
app.handle("sayAgain", sayAgain);
app.handle("getTransferringTips", getTransferringTips);

const expressApp = express().use(bodyParser.json());
expressApp.post("/", app);
expressApp.listen(3300, () => {
	`now listening to 3300`;
});
