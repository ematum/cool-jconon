define(['jquery', 'header', 'cnr/cnr.bulkinfo', 'cnr/cnr', 'cnr/cnr.url', 'cnr/cnr.jconon', 'json!common', 'cnr/cnr.ui', 'i18n', 'json!cache', 'cnr/cnr.call', 'cnr/cnr.search', 'cnr/cnr.ui.widgets', 'cnr/cnr.ui.wysiwyg-placeholder'], function($, header, BulkInfo, CNR, URL, jconon, common, UI, i18n, cache, Call, Search, Widgets, Wysiwyg) {
  "use strict";

  var bulkinfo,
    callMetadata,
    nameForm = 'default',
    comunicazione = $('#comunicazione'),  
    intestazione = $('#intestazione'),
    comunicazioneDetail = $('<div id="comunicazione-detail"></div>'),
    btnSend = $('<div class="text-center"> <button id="send" name="send" class="btn btn-primary btn-large">' + i18n['button.crea.comunicazioni'] + 
      ' <i class="ui-button-icon-secondary ui-icon icon-file" ></i></button> </div>').off('click').on('click', function () {
        if (bulkinfo.validate()) {
          var close = UI.progress(), d = bulkinfo.getData(), 
            applicationIds = bulkinfo.getDataValueById('application');
          d.push({
              id: 'callId',
              name: 'callId',
              value: params.callId
          });        
          jconon.Data.call.comunicazioni({
            type: 'POST',
            data:  d,
            success: function (data) {
              UI.info("Sono state generate " + data.numComunicazioni + " comunicazioni.", function () {
                if (applicationIds == undefined) {
                  window.location = jconon.URL.call.comunicazione.visualizza + '?callId=' + params.callId;
                } else {
                  $('#application').val(-1).trigger("change");
                }
              });
            },
            complete: close,
            error: URL.errorFn
          });
        }
      });

  Widgets['ui.wysiwyg-placeholder'] = Wysiwyg;
  CKEDITOR.on('dialogDefinition', function(event) {
    if ('placeholder' == event.data.name) {
      var input = event.data.definition.getContents('info').get('name');
      input.type = 'select';
      input.items = [];
      $.each(cache.jsonlistCallFields.concat(cache.jsonlistApplicationFieldsNotRequired), function (index, el) {
          input.items.push([el.group + ': ' + el.defaultLabel, el.key]);
      });
    }
  });
  function bulkinfoFunction() {
    bulkinfo = new BulkInfo({
      target: comunicazioneDetail,
      path: 'comunicazioneBulkInfo',
      metadata: callMetadata,
      name: nameForm,
       callback: {
        beforeCreateElement: function (item) {
         if (item.name === 'elenco_field_domanda') {
           item.jsonlist = cache.jsonlistApplicationFieldsNotRequired;
         }
        },
        afterCreateForm: function() {
          comunicazione.append(btnSend);
        }
      }
    });
  }
  function extractApplication(data) {
    var option = '<option></option>',
      ids = data.items;
    ids.every(function(el, index) {
      option = option + '<option data-title="' + el['jconon_application:user'] + '" value="' + el['cmis:objectId'] + '">' + el['jconon_application:cognome'] + ' ' +  el['jconon_application:nome'] + '</option>';
      return true;
    });
    //in caso di selezione del tipo di bando, rimuovo le vecchie option
    $('#application option').remove();
    //...e carico le nuove option
    $('#application').append(option);
    $('#application').parent().after($('<div class="label label-info controls" id="applicationSelected">'));
    $('#application').on("change", function(e) {
        $('#applicationSelected').text('Domande selezionate ' + (e.val ? e.val.length : 0));
    });
  }

  function loadPage() {
    URL.Data.node.node({
      data: {
        excludePath : true,
        nodeRef : params.callId
      },
      callbackErrorFn: jconon.callbackErrorFn,
      success: function (dataCall) {
        callMetadata = dataCall;
        callMetadata['firma'] = 'IL DIRIGENTE';

        intestazione.append(i18n.prop('label.istruzioni.comunicazione', callMetadata['jconon_call:codice']));
        if (Call.isRdP(callMetadata['jconon_call:rdp']) || common.User.admin || common.User.groupsArray.indexOf('GROUP_CONCORSI') !== -1) {
          bulkinfoFunction();
          bulkinfo.render();
          comunicazione.append(comunicazioneDetail);
        } else {
          UI.error(i18n['message.access.denieded'], function () {
            window.location.href = document.referrer;
          });
        }
        var close = UI.progress();
        URL.Data.search.query({
          queue: true,
          data: {
            maxItems:10000,
            q: "SELECT cmis:objectId, jconon_application:cognome, jconon_application:nome, jconon_application:user " +
                " from jconon_application:folder " +
                " where IN_TREE('" + params.callId + "') and jconon_application:stato_domanda = 'C' " +
                " order by jconon_application:cognome, jconon_application:nome"
          }
        }).success(function(data) {
          close();
          extractApplication(data);
        });
      }
    });
  }
  loadPage();
});