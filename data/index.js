const groupsData = require('./groups.json');
const exhibitionsData = require('./exibitions.json');

// Funkcija za izračunavanje početne forme tima
function calculateForm(team, exhibitions) {
    let matches = exhibitions[team.ISOCode] || [];
    let form = 0;

    matches.forEach(match => {
        let result = match.Result.split('-');
        let pointsFor = parseInt(result[0], 10);
        let pointsAgainst = parseInt(result[1], 10);
        form += pointsFor - pointsAgainst; // Dodavanje razlike poena na formu
    });

    return form;
}

// Funkcija za simulaciju utakmice
function simulateGame(team1, team2) {
    
        let rankDifference = team1.FIBARanking - team2.FIBARanking;
        let formDifference = (team1.form || 0) - (team2.form || 0);
    
        // Izračunavanje verovatnoće na osnovu ranga i forme
        let baseProbability = 0.5 + (rankDifference / 20) + (formDifference / 100);
        let randomOutcome = Math.random();
    
        let winner, loser;
        if (randomOutcome < baseProbability) {
            winner = team1;
            loser = team2;
        } else {
            winner = team2;
            loser = team1;
        }
    
        // Ažuriranje forme
        let winnerPoints = Math.floor(Math.random() * 40) + 80;
        let loserPoints = Math.floor(Math.random() * (winnerPoints - 60)) + 60;
    
        winner.form = (winner.form || 0) + (winnerPoints - loserPoints);
        loser.form = (loser.form || 0) + (loserPoints - winnerPoints);
    
        return winner;
}

// Simulacija grupne faze
function simulateGroupStage(groups, exhibitions) {
    let results = {};

    for (let [group, teams] of Object.entries(groups)) {
        let groupResults = [];
        let teamsStats = {};

        // Računanje početne forme za sve timove
        teams.forEach(team => {
            team.form = calculateForm(team, exhibitions);
            teamsStats[team.ISOCode] = {
                ...team,
                form: team.form,
                wins: 0,
                losses: 0,
                points: 0,
                pointsFor: 0,
                pointsAgainst: 0
            };
        });

        // Simulacija utakmica u grupnoj fazi
        for (let i = 0; i < teams.length; i++) {
            for (let j = i + 1; j < teams.length; j++) {
                let team1 = teams[i];
                let team2 = teams[j];

                let winner = simulateGame(team1, team2);
                let loser = winner === team1 ? team2 : team1;

                let winnerPoints = Math.floor(Math.random() * 40) + 80;
                let loserPoints = Math.floor(Math.random() * (winnerPoints-60)) + 60;

                groupResults.push({
                    match: `${team1.Team} vs ${team2.Team}`,
                    result: `${winnerPoints}-${loserPoints}`,
                    winner: winner.Team,
                    loser: loser.Team
                });

                teamsStats[winner.ISOCode].wins++;
                teamsStats[loser.ISOCode].losses++;
                teamsStats[winner.ISOCode].points += 2;
                teamsStats[loser.ISOCode].points += 1;
                teamsStats[winner.ISOCode].pointsFor += winnerPoints;
                teamsStats[winner.ISOCode].pointsAgainst += loserPoints;
                teamsStats[loser.ISOCode].pointsFor += loserPoints;
                teamsStats[loser.ISOCode].pointsAgainst += winnerPoints;

                
               
            }
           
        }
        

        // Ažuriranje timova sa rezultatima
        results[group] = {
            matches: groupResults,
            teams: teams.map(team => teamsStats[team.ISOCode])
        };
    }

    return results;
}

// Funkcija za rangiranje timova unutar grupa
function rankTeams(groupsResults) {
    let rankings = {};

    for (let [group, data] of Object.entries(groupsResults)) {
        let teams = data.teams; // Niz timova
        let matches = data.matches; // Niz mečeva

        if (!Array.isArray(teams)) {
            throw new Error(`Expected teams to be an array, but got ${typeof teams}`);
        }

        if (!Array.isArray(matches)) {
            throw new Error(`Expected matches to be an array, but got ${typeof matches}`);
        }

        // Provera da li su tri tima izjednačena po bodovima
        let tiedTeams = teams.filter(t => t.points === teams[0].points);

        if (tiedTeams.length === 3) {
            tiedTeams.forEach(team => {
                let mutualPointsFor = 0, mutualPointsAgainst = 0;

                let mutualMatches = matches.filter(match => 
                    tiedTeams.some(t => match.match.includes(t.Team) && t.Team !== team.Team) && 
                    match.match.includes(team.Team)
                );

                mutualMatches.forEach(match => {
                    let result = match.result.split('-').map(Number);
                    if (match.match.includes(team.Team)) {
                        if (match.winner === team.Team) {
                            mutualPointsFor += result[0];
                            mutualPointsAgainst += result[1];
                        } else {
                            mutualPointsFor += result[1];
                            mutualPointsAgainst += result[0];
                        }
                    }
                });

                team.mutualPointsDifference = mutualPointsFor - mutualPointsAgainst;
            });

            tiedTeams.sort((a, b) => b.mutualPointsDifference - a.mutualPointsDifference);
        }

        // Rangiranje timova unutar grupe
        teams.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;

            let pointDifferenceA = a.pointsFor - a.pointsAgainst;
            let pointDifferenceB = b.pointsFor - b.pointsAgainst;
            if (pointDifferenceB !== pointDifferenceA) return pointDifferenceB - pointDifferenceA;

            // Provera međusobnog duela
            let headToHeadMatch = matches.find(match => 
                (match.match.includes(a.Team) && match.match.includes(b.Team))
            );

            if (headToHeadMatch) {
                return a.Team === headToHeadMatch.winner ? -1 : 1;
            }

            // Ako su i dalje izjednačeni, koristi ukupno postignute poene
            return b.pointsFor - a.pointsFor;
        });

        rankings[group] = teams;
    }

    return rankings;
}


// Funkcija za određivanje timova koji prolaze u eliminacionu fazu
function determineEliminatingTeams(rankings) {
    let advancingTeams = [];
    let prvoplasirane=[];
    let drugoplasirane=[];
    let treceplasirane=[];
    for (let [group, teams] of Object.entries(rankings)) {
        if (teams.length >= 3) {
            prvoplasirane.push({ ...teams[0], group });
            drugoplasirane.push({ ...teams[1], group });
            treceplasirane.push({ ...teams[2], group });
        }
    }

    prvoplasirane.sort((a, b) => b.points - a.points || (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst));
    drugoplasirane.sort((a, b) => b.points - a.points || (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst));
    treceplasirane.sort((a, b) => b.points - a.points || (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst));
    advancingTeams = [
        ...prvoplasirane, 
        ...drugoplasirane, 
        ...treceplasirane
    ];
    advancingTeams = advancingTeams.slice(0, 8);
    advancingTeams.forEach((team, index) => {
        team.rank = index + 1;
    });
    return advancingTeams;
}

// Funkcija za simulaciju eliminacione faze
function simulateEliminationStage(teams) {
    // Podela timova u šešire prema rangu
    const hatD = teams.slice(0, 2);  // Rang 1 i 2
    const hatE = teams.slice(2, 4);  // Rang 3 i 4
    const hatF = teams.slice(4, 6);  // Rang 5 i 6
    const hatG = teams.slice(6, 8);  // Rang 7 i 8

    // Funkcija za nasumično mešanje niza
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Nasumično mešanje timova u šeširima
    shuffleArray(hatD);
    shuffleArray(hatE);
    shuffleArray(hatF);
    shuffleArray(hatG);

    // Formiranje četvrtfinalnih parova uz proveru međusobnih susreta u grupi
    function formQuarterFinalPairs(hat1, hat2) {
        const pairs = [];

        while (hat1.length > 0) {
            const team1 = hat1.pop();
            const opponentIndex = hat2.findIndex(t => t.group !== team1.group);
            const team2 = opponentIndex !== -1 ? hat2.splice(opponentIndex, 1)[0] : hat2.pop();

            pairs.push([team1, team2]);
        }

        return pairs;
    }

    // Formiranje parova
    const quarterFinalPairs1 = formQuarterFinalPairs(hatD, hatG);
    const quarterFinalPairs2 = formQuarterFinalPairs(hatE, hatF);
    const quarterFinalPairs = [...quarterFinalPairs1, ...quarterFinalPairs2];

    console.log("Četvrtfinalni parovi:");
    quarterFinalPairs.forEach((pair, index) => {
        console.log(`Par ${index + 1}: ${pair[0].Team} vs ${pair[1].Team}`);
    });
    // Simulacija četvrtfinalnih mečeva
    const quarterFinalWinners = quarterFinalPairs.map(pair =>{
        const winner = simulateGame(pair[0], pair[1]);
        console.log(`Rezultat četvrtfinala: ${pair[0].Team} vs ${pair[1].Team} - Pobedio: ${winner.Team}`);
        return winner;
    } );

    // Formiranje parova za polufinale
    const semiFinalPairs = [
        [quarterFinalWinners[0], quarterFinalWinners[2]],
        [quarterFinalWinners[1], quarterFinalWinners[3]]
    ];

    console.log("\nPolufinalni parovi:");
    semiFinalPairs.forEach((pair, index) => {
        console.log(`Par ${index + 1}: ${pair[0].Team} vs ${pair[1].Team}`);
    });

    // Simulacija polufinalnih mečeva
    const semiFinalWinners = semiFinalPairs.map(pair => {
        const winner = simulateGame(pair[0], pair[1]);
        console.log(`Rezultat polufinala: ${pair[0].Team} vs ${pair[1].Team} - Pobedio: ${winner.Team}`);
        return winner;
    });

    // Simulacija finala i meča za treće mesto
    console.log("\nFinale:");
    const final = simulateGame(semiFinalWinners[0], semiFinalWinners[1]);
    console.log(`Rezultat finala: ${semiFinalWinners[0].Team} vs ${semiFinalWinners[1].Team} - Pobedio: ${final.Team}`);
   
    const thirdPlaceTeams = semiFinalPairs
    .flat()
    .filter(team => !semiFinalWinners.includes(team));
    console.log("\nMeč za treće mesto:");
    const thirdPlace = simulateGame(thirdPlaceTeams[0], thirdPlaceTeams[1]);
    console.log(`Rezultat za treće mesto: ${thirdPlaceTeams[0].Team} vs ${thirdPlaceTeams[1].Team} - Pobedio: ${thirdPlace.Team}`);

    return {
        gold: final,
        silver: final === semiFinalWinners[0] ? semiFinalWinners[1] : semiFinalWinners[0],
        bronze: thirdPlace
    };
}


// Glavna logika
const groupResults = simulateGroupStage(groupsData, exhibitionsData);


console.log("Grupna faza - rezultati:");
for (let [group, data] of Object.entries(groupResults)) {
    console.log(`Grupa ${group}:`);
    
    // Ispis rezultata mečeva
    console.log("  Rezultati mečeva:");
    data.matches.forEach(match => {
        console.log(`    ${match.match}: ${match.result} - Pobednik: ${match.winner}`);
    });

    // Ispis statistike timova
    console.log("  Statistika timova:");
    data.teams.forEach(team => {
        console.log(`    Tim: ${team.Team}, ISO: ${team.ISOCode}, Rank: ${team.FIBARanking}, Wins: ${team.wins}, Losses: ${team.losses}, Points: ${team.points}`);
    });
}

const rankings = rankTeams(groupResults);

console.log("\nKonačan plasman u grupama:");
for (let [group, teams] of Object.entries(rankings)) {
    console.log(`  Grupa ${group} (Ime - pobede/porazi/bodovi/postignuti koševi/primljeni koševi/koš razlika):`);
    teams.forEach((team, index) => {
        let pointDifference = team.pointsFor - team.pointsAgainst;
        console.log(`    ${index + 1}. ${team.Team}  ${team.wins} / ${team.losses} / ${team.points} / ${team.pointsFor} / ${team.pointsAgainst} / ${pointDifference >= 0 ? '+' : ''}${pointDifference}`);
    });
}

let advancingTeams = determineEliminatingTeams(rankings);

console.log("\nTimovi koji prolaze u eliminacionu fazu:");
advancingTeams.forEach((team, index) => {
    console.log(`  ${index + 1}. ${team.Team} (Grupa ${team.group})`);
});



let medalWinners = simulateEliminationStage(advancingTeams);

console.log("\nMedalje:");
console.log(`  1. ${medalWinners.gold.Team}`);
console.log(`  2. ${medalWinners.silver.Team}`);
console.log(`  3. ${medalWinners.bronze.Team}`);
