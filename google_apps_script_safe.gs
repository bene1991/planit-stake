/**
 * VERSÃO SAFE - RISCO ZERO
 * Este script NÃO possui funções de deleção.
 * Ele apenas ADICIONA novos alertas ou ATUALIZA resultados de alertas existentes.
 */

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Simulação");
  var params = JSON.parse(e.postData.contents);
  var action = params.action || 'NEW_ALERT';
  
  var fixtureId = String(params.fixtureId || "");
  var home = String(params.homeTeam || "").toLowerCase().trim();
  var away = String(params.awayTeam || "").toLowerCase().trim();
  
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  
  // Busca o jogo na planilha (por ID ou Nome dos Times)
  for (var i = 1; i < data.length; i++) {
    var rowFixtureId = String(data[i][10] || ""); // Coluna K (Índice 10)
    var rowMatch = String(data[i][1]).toLowerCase(); // Coluna B (Índice 1)
    
    if ((fixtureId !== "" && rowFixtureId === fixtureId) || 
        (home !== "" && away !== "" && rowMatch.includes(home) && rowMatch.includes(away))) {
      rowIndex = i + 1;
      break; 
    }
  }

  if (action === 'NEW_ALERT') {
    // Se o jogo NÃO existe, adiciona no final
    if (rowIndex === -1) {
      sheet.appendRow([
        params.dateAt || new Date().toLocaleDateString('pt-BR'), 
        params.homeTeam + " vs " + params.awayTeam,            
        params.league, 
        params.alertName || "Variação", 
        params.alertMinute,                                           
        "", "", "PENDENTE", "", "", fixtureId                                              
      ]);
      return ContentService.createTextOutput("Novo alerta adicionado.");
    }
    return ContentService.createTextOutput("Jogo já existe. Nenhuma ação tomada.");
  }

  if (action === 'UPDATE_ALERT') {
    // Se o jogo existe, ATUALIZA apenas as colunas de resultado e placar
    if (rowIndex !== -1) {
      sheet.getRange(rowIndex, 6).setValue(params.goalsInterval || "-"); 
      sheet.getRange(rowIndex, 7).setValue(params.finalScore || "");      
      sheet.getRange(rowIndex, 8).setValue(params.result);               
      sheet.getRange(rowIndex, 11).setValue(fixtureId);
      
      var resultCell = sheet.getRange(rowIndex, 8);
      if (params.result === 'GREEN') resultCell.setBackground("#27ae60").setFontColor("white");
      else if (params.result === 'RED') resultCell.setBackground("#c0392b").setFontColor("white");
      else if (params.result === 'VOID') resultCell.setBackground("#f1c40f").setFontColor("black");
      
      return ContentService.createTextOutput("Resultado atualizado com segurança.");
    }
    return ContentService.createTextOutput("Aviso: Jogo não encontrado para atualização.");
  }
  
  return ContentService.createTextOutput("Ação desconhecida.");
}
