
/* javascript closure providing all the search functionalities */
define(['jquery', 'cnr/cnr', 'i18n', 'cnr/cnr.actionbutton', 'json!common', 'handlebars',
  'cnr/cnr.validator', 'cnr/cnr.url', 'cnr/cnr.ui', 'cnr/cnr.jconon', 'cnr/cnr.url',
  'cnr/cnr.ace', 'cnr/cnr.ui.authority', 'cnr/cnr.search', 'cnr/cnr.criteria', 'cnr/cnr.bulkinfo', 'cnr/cnr.ui.checkbox', 'json!cache', 'searchjs'
  ], function ($, CNR, i18n, ActionButton, common, Handlebars, validator, cnrurl, UI, jconon, URL, Ace, Authority, Search, Criteria, BulkInfo, Checkbox, cache) {
  "use strict";
  //TODO Creare un cnr.group dove spostare le funzione comune a cnr.explorer
  function addChild(parent, child, callback) {
    URL.Data.proxy.childrenGroup({
      type: 'POST',
      data: JSON.stringify({
        'parent_group_name': parent,
        'child_name': child
      }),
      contentType: 'application/json'
    }).done(function () {
      UI.success(child + ' aggiunto al gruppo ' + parent);
      callback();
    }).fail(function () {
      UI.error("impossibile aggiungere " + child + " al gruppo " + parent);
    });
  }

  function remove(codice, id, objectTypeId, callback) {
    UI.confirm(i18n.prop('label.call.confirm.delete', codice), function () {
      var close = UI.progress();
      jconon.Data.call.main({
        type: 'DELETE',
        placeholder: {
          'cmis:objectId': id,
          "cmis:objectTypeId" : objectTypeId
        },
        success: function (data) {
          UI.success(i18n['message.operation.performed'], function () {
            if (callback) {
              callback();
            }
          });
        },
        complete: close,
        error: URL.errorFn
      });
    });
  }
  function publishCall(data, publish, callback) {
    var close = UI.progress();
    data.push({name: 'publish', value: publish});
    jconon.Data.call.publish({
      type: 'POST',
      data: data,
      success: function (data) {
        UI.success(i18n['message.operation.performed'], function () {
          if (callback) {
            var pubblicato = data.published,
              removeClass = pubblicato ? 'icon-eye-open' : 'icon-eye-close',
              addClass = pubblicato ? 'icon-eye-close' : 'icon-eye-open',
              title = pubblicato ? i18n['button.unpublish'] : i18n['button.publish'];
            callback(pubblicato, removeClass, addClass, title, data);
          }
        });
      },
      complete: close,
      error: URL.errorFn
    });
  }
  function isActive(inizio, fine) {
    var data_inizio = CNR.Date.parse(inizio),
      data_fine = CNR.Date.parse(fine),
      data_now = CNR.Date.parse(common.now);
    if (data_inizio <= data_now && data_fine >= data_now) {
      return true;
    }
    return false;
  }
  function filter(bulkInfo, search, method, type, value, attivi_scadutiValue) {
    var criteria = jconon.getCriteria(bulkInfo, attivi_scadutiValue);
    if (method) {
      criteria[method].call(null, type, value);
    }
    criteria.list(search);
  }
  function groupCommission(name, element, callback) {
    var groupName = ('GROUP_' + name).substring(0, 100),
      specificSettings = {
        data: {
          filter: groupName,
          maxItems: 1
        },
        success: function (data) {
          if (!data.groups[0]) {
            return false;
          }
          var parentNodeRef = data.groups[0].nodeRef;
          URL.Data.proxy.childrenGroup({
            data: {
              fullName: groupName
            },
            success: function (data) {
              var table = $('<table class="table table-striped commission"></table>'),
                tfoot = $('<tfoot><tr><td colspan="2"></td></tr></tfoot>');
              $.each(data, function (index, el) {
                var item = {
                  baseTypeId: el.attr.type,
                  allowableActions: el.attr.allowableActions,
                  nodeRef: el.attr.id,
                  name: el.data,
                  group: parentNodeRef,
                  authorityId: el.attr.authorityId
                },
                  isUser = el.attr.type === 'USER',
                  btn = ActionButton.actionButton(item, null, null, null, callback),
                  td = $('<td></td>').addClass('span10'),
                  row = $('<tr></tr>'),
                  a = $('<a href="#undefined">' + el.attr.displayName + '</a>').click(function () {
                    Ace.showMetadata(el.attr.authorityId);
                  });

                td.append('<i class="' + (isUser ? 'icon-user' : 'icon-group icon-blue') + '"></i> ')
                  .append(a)
                  .append('<span class="muted annotation">' + el.attr.shortName + '</span>');

                row
                  .append(td)
                  .append($('<td></td>').addClass('span2').append(btn));
                table.append(row);
              });
              tfoot.appendTo(table);
              tfoot.find('td')
                .append('<button type="button" class="btn btn-mini btn-primary create-acl">' +
                  '<i class="icon-resize-small"></i> Crea associazione</button>')
                .append(' ')
                .append('<button type="button" class="btn btn-mini permissions">' +
                  '<i class="icon-user"></i> Autorizzazioni</button>');
              element.append(table);
              table.find('.create-acl').off('click').on('click', function () {
                var widget = Authority.Widget("username", null);
                UI.modal("Seleziona utente", widget, function () {
                  addChild(groupName, widget.data('value'), callback);
                });
              });
              table.find('.permissions').off('click').on('click', function () {
                Ace.panel(parentNodeRef, null, ["FullControl", "Read", "Write"]);
              });
            }
          });
        }
      };
    URL.Data.proxy.groups(specificSettings);
  }
  function commissione(name, content) {
    groupCommission(name, content, function () {
      content.find('table.commission').remove();
      commissione(name, content);
    });
  }
  function callActiveCriteria(callTypeId, callId, cmisParentId, filterAll) {
    var criteria = new Criteria();
    criteria.lte('jconon_call:data_inizio_invio_domande', common.now, 'date');
    criteria.gte('jconon_call:data_fine_invio_domande', common.now, 'date');
    criteria.notEq('cmis:objectId', callId, 'string');
    if (cmisParentId && !filterAll) {
      criteria.inFolder(cmisParentId, 'canSubmit');
    }
    return criteria;
  }

  function displayAttachments(id) {

    var content = $('<div></div>').addClass('modal-inner-fix');
    jconon.findAllegati(id, content, null, null, function (el, refreshFn, permission) {
      return jconon.defaultDisplayDocument(el, refreshFn, permission, false);
    });

    UI.modal(i18n['actions.attachments'], content);

  }

  function displayRow(bulkInfo, search, typeId, rootTypeId, resultSet, target, isForCopyApplication) {
    var xhr = new BulkInfo({
      target: $('<tbody>').appendTo(target),
      handlebarsId: 'call-main-results',
      path: typeId,
      metadata: resultSet,
      handlebarsSettings: {
        call_type: typeId === rootTypeId ? true : false
      }
    }).handlebars();

    xhr.done(function () {
      target.off('click').on('click', '.requirements', function () {
        var data = $("<div></div>").addClass('modal-inner-fix').html($(this).data('content'));
        UI.modal('<i class="icon-info-sign text-info animated flash"></i> ' + i18n['label.th.jconon_bando_elenco_titoli_studio'], data);
      });

      var rows = target.find('tbody tr'),
        customButtons = {
          select: false
        };
      $.each(resultSet, function (index, el) {
        var secondaryObjectTypeIds = el['cmis:secondaryObjectTypeIds'] || el.aspect,
          isMacroCall = secondaryObjectTypeIds === null ? false : secondaryObjectTypeIds.indexOf('P:jconon_call:aspect_macro_call') >= 0,
          row,
          azioni;
        if (isForCopyApplication) {
          customButtons.paste = function () {
            UI.confirm(i18n.prop('message.jconon_application_copia_domanda', el['jconon_call:codice']), function () {
              var close = UI.progress();
              jconon.Data.application.paste({
                type: 'POST',
                data: {
                  "applicationSourceId": el.applicationId,
                  "callTargetId": el.id
                },
                success: function (data) {
                  window.location = jconon.URL.application.manage + '?callId=' + el.id + '&applicationId=' + data['cmis:objectId'];
                },
                complete: close
              });
            });
          };
        } else {
          customButtons.attachments = function () {
            displayAttachments(el.id);
          };
          customButtons.edit = function () {
            window.location = jconon.URL.call.manage + '?call-type=' + el.objectTypeId + '&cmis:objectId=' + el.id;
          };
          customButtons.listApplication = function () {
            window.location = jconon.URL.application.list + '?cmis:objectId=' + el.id;
          };
          customButtons.application = !isMacroCall &&
            (isActive(el.data_inizio_invio_domande, el.data_fine_invio_domande) || el.data_fine_invio_domande === null) ? function () {
              window.location = jconon.URL.application.manage + '?callId=' + el.id;
            } : false;
          customButtons.detail = !isMacroCall ? false : function () {
            filter(bulkInfo, search, 'equals', 'cmis:parentId', el.id);
          };
          customButtons.remove = function () {
            remove(el.codice, el.id, el.objectTypeId, function () {
              filter(bulkInfo, search);
            });
          };
          customButtons.permissions = function () {
            Ace.panel(el['alfcmis:nodeRef'] || el['cmis:objectId'], el.name, null, false);
          };
          customButtons.publish = function () {
            var that =  $(this),
              published = el['jconon_call:pubblicato'],
              message = published ? i18n['message.action.unpublish'] : i18n['message.action.publish'];
            UI.confirm(message, function () {
              publishCall([
                {name: 'cmis:objectId', value: el.id},
                {name: 'cmis:objectTypeId', value: el.objectTypeId},
                {name: 'skip:save', value: true}
              ], !published, function (pubblicato, removeClass, addClass, title) {
                el['jconon_call:pubblicato'] = pubblicato;
                that.find('i')
                  .removeClass(removeClass)
                  .addClass(addClass);
              });
            });
          };
          customButtons.commission = function () {
            var content = $('<div></div>').addClass('modal-inner-fix');
            commissione(el.name, content);
            UI.modal('Modifica Commissione', content);
          };
          customButtons.exportApplications = function () {
            UI.confirm(i18n.prop('message.jconon_application_zip_domande', el['jconon_call:codice']), function () {
              var close = UI.progress(),
                nodeRef = el.id,
                reNodeRef = new RegExp("([a-z]+)\\:\/\/([a-z]+)\/(.*)", 'gi');
              jconon.Data.application.exportApplications({
                /*data: {
                  "deleteFinalFolder": true
                },*/
                placeholder: {
                  "store_type" : nodeRef.replace(reNodeRef, '$1'),
                  "store_id" : nodeRef.replace(reNodeRef, '$2'),
                  "id" : nodeRef.replace(reNodeRef, '$3')
                },
                success: function (data) {
                  UI.success("File creato correttamente: <a href='" + cache.baseUrl + data.url + "'> Download </a>", function () {
                    //Cancello lo zip creato se NON viene scaricato
                    var fd = new CNR.FormData();
                    fd.data.append("cmis:objectId", data.nodeRefZip.split(';')[0]);

                    URL.Data.node.node({
                      data: fd.getData(),
                      contentType: fd.contentType,
                      processData: false,
                      type: 'DELETE',
                      error: function () {}
                    });
                  });
                },
                complete: close
              });
            });
          };
          customButtons.copy = false;
          customButtons.cut = false;
        }
        azioni = new ActionButton.actionButton({
          name: el.name,
          nodeRef: el.id,
          baseTypeId: el.baseTypeId,
          objectTypeId: el.objectTypeId,
          mimeType: el.contentType,
          allowableActions: el.allowableActions,
          defaultChoice: isMacroCall ? 'detail' : 'application'
        }, {publish: 'CAN_APPLY_ACL', commission: 'CAN_APPLY_ACL', listApplication: 'CAN_CREATE_DOCUMENT', exportApplications: 'CAN_CREATE_DOCUMENT'},
          customButtons, {
            application: 'icon-edit',
            detail: 'icon-sitemap',
            attachments : 'icon-download-alt',
            publish: el['jconon_call:pubblicato'] ? 'icon-eye-close' : 'icon-eye-open',
            commission: 'icon-group',
            listApplication: 'icon-folder-open-alt',
            exportApplications: 'icon-exchange',
            paste: 'icon-paste'
          });
        row = $(rows.get(index));
        if (!isMacroCall) {
          row
            .css('background-color', 'rgb(250, 254, 255)');
          //.find('td:first').css('padding-left', '30px');

        }
        azioni.appendTo(row.find('td:last'));
      });
    });
  }
  /* Revealing Module Pattern */
  return {
    remove: remove,
    publish: publishCall,
    isActive: isActive,
    filter: filter,
    groupCommission: groupCommission,
    displayRow : displayRow,
    displayAttachments: displayAttachments,
    pasteApplication : function (applicationId, callTypeId, callId, hasMacroCall) {
      var modal,
        type = callTypeId.substring(2) +
          ' join jconon_call:can_submit_application AS canSubmit on ' +
          ' canSubmit.cmis:objectId = cmis:objectId',
        mandatoryAspects,
        aspectQuery,
        cmisParentId,
        activeCalls,
        content = $('<div></div>').addClass('modal-inner-fix'),
        pagination = $('<div class="pagination pagination-centered"><ul></ul></div>'),
        displayTable = $('<table class="table table-striped"></table>'),
        searchPanel = $('<div class="input-append"></div>'),
        nresults = $('<span class="muted"><span>'),
        query = $('<input type="text" placeholder="' + i18n['label.freesearch.placeholder'] + '" class="span6">')
          .appendTo(searchPanel),
        filterAllCall = Checkbox.Widget('filerAllCall', 'Visualizza tutti i bandi', {name : 'filterAllCall', val : true})
          .addClass('form-horizontal').on('setData', function (event, key, value) {
            callActiveCriteria(callTypeId, callId, cmisParentId, value).list(activeCalls);
          }),
        orderBy = $('<div id="orderBy" class="btn-group">' +
                '<a class="btn dropdown-toggle" data-toggle="dropdown" href="#">' + i18n['button.order.by'] +
                '<span class="caret"></span></a><ul class="dropdown-menu"></ul></div>').appendTo(displayTable).after(nresults),
        emptyResultset = $('<div class="alert"></div>').hide().append(i18n['label.count.no.document']),
        columns = [],
        sortFields = {
          nome: null,
          'data di creazione': null
        },
        xhr = URL.Data.bulkInfo({
          placeholder: {
            path: callTypeId,
            kind: 'column',
            name: 'home'
          },
          data: {
            guest : true
          }
        });
      /*jslint unparam: true*/
      $.each(cache.jsonlistTypeWithMandatoryAspects, function (index, el) {
        if (el.key === callTypeId) {
          mandatoryAspects = el.mandatoryAspects;
        }
      });
      if (mandatoryAspects) {
        $.each(mandatoryAspects, function (index, el) {
          aspectQuery = el.substring(2);
          type += ' join ' + aspectQuery + ' AS ' + aspectQuery + ' on ' +
            aspectQuery + '.cmis:objectId = cmis:objectId';
        });
      }
      xhr.success(function (data) {
        $.map(data[data.columnSets[0]], function (el) {
          if (el.inSelect !== false) {
            columns.push(el.property);
          }
        });
        $.each(data[data.columnSets[0]], function (index, el) {
          if (el['class'] && el['class'].split(' ').indexOf('sort') >= 0) {
            sortFields[i18n.prop(el.label, el.label)] = el.property;
          }
        });
        activeCalls = new Search({
          elements: {
            table: displayTable,
            pagination: pagination,
            label: emptyResultset,
            orderBy: orderBy
          },
          orderBy: {
            field: 'jconon_call:codice',
            asc: true
          },
          type: type,
          columns: columns,
          fields: sortFields,
          mapping: function (mapping, doc) {
            $.each(data[data.columnSets[0]], function (index, el) {
              var pointIndex = el.property.indexOf('.'),
                property = pointIndex !== -1 ? el.property.substring(pointIndex + 1) : el.property;
              mapping[el.name] = doc[property] !== undefined ? doc[property] : null;
            });
            mapping.aspect = doc.aspect !== undefined ? doc.aspect : null;
            mapping.applicationId = applicationId;
            return mapping;
          },
          fetchCmisObject: false,
          maxItems: 10,
          display : {
            resultSet: function (resultSet, target) {
              query.val('')
                .attr("disabled", true)
                .tooltip({
                  html: true,
                  title: 'Effettua la ricerca su <u>tutti</u> i campi.'
                });
              nresults.text('');
              var parentType = activeCalls.changeType(),
                criteriaMaxItems = new Criteria(),
                searchjs = new Search({
                  type: activeCalls.changeType(),
                  disableRequestReplay: 'sub_' + activeCalls.changeType() + '_',
                  maxItems: 1000,
                  fetchCmisObject: false,
                  columns: columns,
                  mapping: function (mapping, doc) {
                    $.each(data[data.columnSets[0]], function (index, el) {
                      var pointIndex = el.property.indexOf('.'),
                        property = pointIndex !== -1 ? el.property.substring(pointIndex + 1) : el.property;
                      mapping[el.name] = doc[property] !== undefined ? doc[property] : null;
                    });
                    mapping.aspect = doc.aspect !== undefined ? doc.aspect : null;
                    mapping.applicationId = applicationId;
                    return mapping;
                  },
                  display: {
                    after: function (documents, unused, resultSetx) {
                      query.searchjs({
                        content: documents.items,
                        engine: {
                          logger: false,
                          allowed: function (key) {
                            if (key === 'cmis:name' || !/^cmis/g.test(key)) {
                              return true;
                            }
                          }
                        },
                        display: function (resultSet) {
                          nresults.text('');
                          displayTable.find('tbody tr').remove();
                          var items = [];
                          $.each(resultSet, function (index, el) {
                            items.push(resultSetx[el]);
                          });
                          displayRow(xhr, activeCalls, callTypeId, undefined, items, target, true);
                          pagination.hide();
                          if (query.val().trim().length === 0) {
                            callActiveCriteria(callTypeId, callId, cmisParentId, filterAllCall.data('value')).list(activeCalls);
                          } else {
                            nresults.text(' ' + resultSet.length + ' ' + (resultSet.length === 1 ? 'bando trovato' : 'bandi trovati'));
                          }
                        }
                      });
                    }
                  }
                });
              callActiveCriteria(callTypeId, callId, cmisParentId, filterAllCall.data('value')).list(searchjs);
              displayRow(xhr, activeCalls, callTypeId, undefined, resultSet, target, true);
            }
          }
        });
        searchPanel
          .append(orderBy);
        content
          .append(searchPanel)
          .append(emptyResultset)
          .append(filterAllCall)
          .append(displayTable)
          .append(pagination);
        if (hasMacroCall) {
          URL.Data.search.query({
            queue: true,
            data: {
              q: "select cmis:parentId from jconon_call:folder where cmis:objectId ='" + callId + "'"
            }
          }).done(function (rs) {
            if (rs.totalNumItems === 1) {
              cmisParentId = rs.items[0]['cmis:parentId'];
            }
            callActiveCriteria(callTypeId, callId, cmisParentId, filterAllCall.data('value')).list(activeCalls);
          });
        } else {
          callActiveCriteria(callTypeId, callId, cmisParentId, filterAllCall.data('value')).list(activeCalls);
        }
        modal = UI.bigmodal(i18n['title.call.active'], content);
      });
    }
  };
});