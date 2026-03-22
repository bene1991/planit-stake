function doPost(e) {
  var params = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var variation = params.variation || "";
  var sheetName = "HISTÓRICO - " + variation;
  var sheet = ss.getSheetByName(sheetName) || ss.getSheetByName(sheetName + " - Simulação");
  
  if (!sheet) {
    // If sheet doesn't exist, maybe it's just the variation name
    sheet = ss.getSheetByName(variation);
  }
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": "Sheet not found: " + sheetName + (variation ? " or " + variation : "")
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getDataRange().getValues();
  
  var action = params.action || params.status || 'NEW_ALERT';
  
  if (action === 'CLEANUP_DUPLICATES') {
    return cleanupDuplicates(sheet);
  }

  var fixtureId = String(params.fixtureId || "");
  
  var home = "";
  var away = "";
  
  if (params.homeTeam && params.awayTeam) {
    home = String(params.homeTeam).toLowerCase().trim();
    away = String(params.awayTeam).toLowerCase().trim();
  } else if (params.match) {
    var teams = params.match.split(" vs ");
    if (teams.length === 2) {
      home = teams[0].toLowerCase().trim();
      away = teams[1].toLowerCase().trim();
    }
  }
  
  var matchNameSearch = (home + " vs " + away).toLowerCase();
  var league = params.league || "";
  var minute = params.alertMinute || "";
  var goals = params.goalMinutes || "";
  var finalScore = params.finalScore || params.final_score || "";

  // Encontrar TODAS as linhas que dão match (por ID ou por Nome do Jogo)
  var rowIndices = [];
  for (var i = 1; i < data.length; i++) {
    var rowFixtureId = String(data[i][10]);
    var rowMatchName = String(data[i][1]).toLowerCase();
    
    var idMatch = (rowFixtureId === fixtureId && fixtureId !== "undefined" && fixtureId !== "");
    var nameMatch = (rowMatchName.indexOf(matchNameSearch) !== -1 && rowMatchName !== "");
    
    if (idMatch || nameMatch) {
      rowIndices.push(i + 1);
    }
  }

  if (action === 'NEW_ALERT') {
    if (rowIndices.length === 0) {
      sheet.appendRow([
        params.dateAt || new Date().toLocaleDateString('pt-BR'), 
        params.homeTeam + " vs " + params.awayTeam,            
        params.league,                                         
        params.alertName,                                      
        params.alertMinute,                                           
        "", "", "PENDENTE", "", "", fixtureId                                              
      ]);
      return ContentService.createTextOutput("Novo alerta criado.");
    } else {
      // Se já existe, apenas garante que o ID está na coluna K
      rowIndices.forEach(function(idx) {
        sheet.getRange(idx, 11).setValue(fixtureId);
      });
      return ContentService.createTextOutput("Jogo já existe. ID sincronizado.");
    }
  }

  if (action === 'UPDATE_ALERT') {
    if (rowIndices.length > 0) {
      rowIndices.forEach(function(idx) {
        sheet.getRange(idx, 6).setValue(params.goalsInterval || "-"); 
        sheet.getRange(idx, 7).setValue(params.finalScore || "");      
        sheet.getRange(idx, 8).setValue(""); // Limpa resultado
        sheet.getRange(idx, 8).setBackground("white").setFontColor("black");
        sheet.getRange(idx, 11).setValue(fixtureId); // Garante ID
      });
      return ContentService.createTextOutput("Linha(s) atualizada(s).");
    }
    return ContentService.createTextOutput("Nenhuma linha correspondente encontrada.");
  }
}

function cleanupDuplicates(sheet) {
  var data = sheet.getDataRange().getValues();
  var seen = {};
  var rowsToDelete = [];
  
  for (var i = 1; i < data.length; i++) {
    var fid = String(data[i][10]);
    var matchName = String(data[i][1]).toLowerCase().trim();
    var key = (fid && fid !== "undefined" && fid !== "") ? fid : matchName;
    
    if (!key || key === "") continue;
    
    if (seen[key]) {
      rowsToDelete.push(i + 1);
    } else {
      seen[key] = true;
    }
  }
  
  for (var j = rowsToDelete.length - 1; j >= 0; j--) {
    sheet.deleteRow(rowsToDelete[j]);
  }
  return ContentService.createTextOutput("Removidas " + rowsToDelete.length + " duplicatas.");
}
