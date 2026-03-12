function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Simulação");
  var params = JSON.parse(e.postData.contents);
  var data = sheet.getDataRange().getValues();
  
  var action = params.action || 'NEW_ALERT';
  
  if (action === 'CLEANUP_DUPLICATES') {
    return cleanupDuplicates(sheet);
  }

  var fixtureId = String(params.fixtureId);
  var matchNameSearch = (params.homeTeam + " vs " + params.awayTeam).toLowerCase();
  
  // Encontrar TODAS as linhas que dão match (por ID ou por Nome do Jogo)
  var rowIndices = [];
  for (var i = 1; i < data.length; i++) {
    var rowFixtureId = String(data[i][10]);
    var rowMatchName = String(data[i][1]).toLowerCase();
    
    var idMatch = (rowFixtureId === fixtureId && fixtureId !== "undefined");
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
        sheet.getRange(idx, 8).setValue(params.result);               
        sheet.getRange(idx, 11).setValue(fixtureId); // Garante ID
        
        var resultCell = sheet.getRange(idx, 8);
        if (params.result === 'GREEN') resultCell.setBackground("#27ae60").setFontColor("white");
        else if (params.result === 'RED') resultCell.setBackground("#c0392b").setFontColor("white");
        else if (params.result === 'VOID') resultCell.setBackground("#f1c40f").setFontColor("black");
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
