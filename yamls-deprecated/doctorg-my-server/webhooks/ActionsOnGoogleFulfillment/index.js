const { conversation } = require("@assistant/conversation");
const functions = require("firebase-functions");
const admin = require("firebase-admin");

// can put a config inside initializeApp which would be dependent on which database. actually this whole process of CRUD would be dependent on
// the how the software company does ith
admin.initializeApp();
const database = admin.firestore();

const app = conversation();

const employeeIdNumber = (conv) => {
	conv.add("youre super ugly!");
	// conv.session.params.employeeIdNumber = conv.intent.query;
	// conv.scene.next.name = "passPhrase";
};

const logIn = async (conv) => {
	conv.session.params.passPhrase = conv.intent.query;
	await database
		.collection("Employees")
		.where("employeeIdNumber", "==", `${conv.session.params.employeeIdNumber}`)
		.get()
		.then((employees) => {
			if (employees.docs[0]) {
				if (
					employees.docs[0].data().passPhrase == conv.session.params.passPhrase
				) {
					conv.session.params.firstName = employees.docs[0].data().firstName;
					conv.scene.next.name = "start";
				} else {
					conv.add("Wrong ID number and/or pass phrase. ");
					conv.scene.next.name = "employeeIdNumber";
				}
			} else {
				conv.add("Wrong ID number and/or pass phrase. ");
				conv.scene.next.name = "employeeIdNumber";
			}
		});
};

// // to simulate call button being pressed, promisifying setTimeout
// function timeout(ms) {
//     return new Promise(resolve => setTimeout(resolve, ms));
// }

const start = (conv) => {
	// //   to simulate call button being pressed. so far doesnt work.
	// 	timeout(10000).then(() => conv.add("room 223 is calling"));

	// //   just to speed things up during development
	//   conv.session.params.employeeIdNumber = '1234';
	//   if it's the first time logging in for the session
	if (conv.session.params.passPhrase) {
		conv.session.params.passPhrase = null;
		conv.add(
			`Hello ${conv.session.params.firstName}. What would you like me to record?`
		);
	} else {
		conv.add("What else would you like me to record?");
	}
};

// can't have a roomNumber 2 because google translates it as 'to'
const roomVerification = async (conv) => {
	return await database
		.collection("Patients")
		.where("roomNumber", "==", conv.session.params.roomNumber.toLowerCase())
		.get()
		.then((patients) => {
			if (!patients.docs[0]) {
				conv.add(
					"I couldn't find that room number. Please record this event manually. "
				);
				conv.scene.next.name = "start";
				return false;
			} else return patients.docs[0].data();
		});
};

const recordMealConsumption = async (conv) => {
	await roomVerification(conv).then(async (patient) => {
		if (patient) {
			await database.collection("ActivityLog").add({
				employeeIdNumber: conv.session.params.employeeIdNumber,
				firstName: patient.firstName,
				lastName: patient.lastName,
				roomNumber: patient.roomNumber,
				timeStamp: Date.now(),
				meal: conv.session.params.meal,
				percentEaten: conv.session.params.percentEaten,
				hasMeal: true,
			});
			await conv.add(
				`Okay, I recorded that ${patient.firstName} ${patient.lastName} ate ${conv.session.params.percentEaten} of their ${conv.session.params.meal}. `
			);
			conv.scene.next.name = "start";
		}
	});
};

const bowel = async (conv) => {
	await roomVerification(conv).then(async (patient) => {
		if (patient) {
			await database.collection("ActivityLog").add({
				employeeIdNumber: conv.session.params.employeeIdNumber,
				firstName: patient.firstName,
				lastName: patient.lastName,
				roomNumber: patient.roomNumber,
				timeStamp: Date.now(),
				bowel: conv.session.params.bowel,
				continentIncontinent: conv.session.params.continentIncontinent,
				stoolConsistency: conv.session.params.stoolConsistency,
			});
			await conv.add(`Okay, I recorded that ${patient.firstName} ${patient.lastName} was ${conv.session.params.continentIncontinent} 
      	in the bowel and it was ${conv.session.params.stoolConsistency}. `);
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
          ${doc.data().percentEaten} of his ${doc.data().meal}. `;
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

const noMatch = (conv) => {
	conv.add("Sorry, can you repeat that?");
	conv.scene.next.name = conv.scene.name;
};

const repeat = (conv) => {
	conv.scene.next.name = conv.scene.name;
};

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

app.handle("employeeIdNumber", employeeIdNumber);
app.handle("logIn", logIn);
app.handle("start", start);
app.handle("recordMealConsumption", recordMealConsumption);
app.handle("bowel", bowel);
// app.handle('activityLog', activityLog);
app.handle("noMatch", noMatch);
app.handle("repeat", repeat);
app.handle("whenEat", whenEat);
app.handle("whenBowel", whenBowel);
app.handle("tipsTransferring", tipsTransferring);

exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
