// Copyright (C) 2017 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
(function() {
  'use strict';

  // Maximum length for patch set descriptions.
  const PATCH_DESC_MAX_LENGTH = 500;

  Polymer({
    is: 'gr-file-list-header',

    properties: {
      account: Object,
      allPatchSets: Array,
      /** @type {?} */
      change: Object,
      changeNum: String,
      changeUrl: String,
      changeComments: Object,
      commitInfo: Object,
      editLoaded: Boolean,
      loggedIn: Boolean,
      serverConfig: Object,
      shownFileCount: Number,
      diffPrefs: Object,
      diffViewMode: {
        type: String,
        notify: true,
      },
      patchNum: String,
      basePatchNum: String,
      filesExpanded: String,
      // Caps the number of files that can be shown and have the 'show diffs' /
      // 'hide diffs' buttons still be functional.
      _maxFilesForBulkActions: {
        type: Number,
        readOnly: true,
        value: 225,
      },
      _patchsetDescription: {
        type: String,
        value: '',
      },
      _descriptionReadOnly: {
        type: Boolean,
        computed: '_computeDescriptionReadOnly(loggedIn, change, account)',
      },
      /** @type {?} */
      _VIEW_MODES: {
        type: Object,
        readOnly: true,
        value: {
          SIDE_BY_SIDE: 'SIDE_BY_SIDE',
          UNIFIED: 'UNIFIED_DIFF',
        },
      },
      _revisionInfo: {
        type: Object,
        computed: '_getRevisionInfo(change)',
      },
    },

    behaviors: [
      Gerrit.PatchSetBehavior,
    ],

    observers: [
      '_computePatchSetDescription(change, patchNum)',
    ],

    _expandAllDiffs() {
      this._expanded = true;
      this.fire('expand-diffs');
    },

    _collapseAllDiffs() {
      this._expanded = false;
      this.fire('collapse-diffs');
    },

    _computeSelectedClass(diffViewMode, buttonViewMode) {
      return buttonViewMode === diffViewMode ? 'selected' : '';
    },

    _computeExpandedClass(filesExpanded) {
      const classes = [];
      if (filesExpanded === GrFileListConstants.FilesExpandedState.ALL) {
        classes.push('expanded');
      }
      if (filesExpanded === GrFileListConstants.FilesExpandedState.SOME ||
            filesExpanded === GrFileListConstants.FilesExpandedState.ALL) {
        classes.push('openFile');
      }
      return classes.join(' ');
    },

    _handleSideBySideTap() {
      this.diffViewMode = this._VIEW_MODES.SIDE_BY_SIDE;
    },

    _handleUnifiedTap() {
      this.diffViewMode = this._VIEW_MODES.UNIFIED;
    },

    _computeDescriptionPlaceholder(readOnly) {
      return (readOnly ? 'No' : 'Add') + ' patchset description';
    },

    _computeDescriptionReadOnly(loggedIn, change, account) {
      return !(loggedIn && (account._account_id === change.owner._account_id));
    },

    _computePatchSetDescription(change, patchNum) {
      const rev = this.getRevisionByPatchNum(change.revisions, patchNum);
      this._patchsetDescription = (rev && rev.description) ?
          rev.description.substring(0, PATCH_DESC_MAX_LENGTH) : '';
    },

    _handleDescriptionRemoved(e) {
      return this._updateDescription('', e);
    },

    /**
     * @param {!Object} revisions The revisions object keyed by revision hashes
     * @param {?Object} patchSet A revision already fetched from {revisions}
     * @return {string|undefined} the SHA hash corresponding to the revision.
     */
    _getPatchsetHash(revisions, patchSet) {
      for (const rev in revisions) {
        if (revisions.hasOwnProperty(rev) &&
            revisions[rev] === patchSet) {
          return rev;
        }
      }
    },

    _handleDescriptionChanged(e) {
      const desc = e.detail.trim();
      this._updateDescription(desc, e);
    },

    /**
     * Update the patchset description with the rest API.
     * @param {string} desc
     * @param {?(Event|Node)} e
     * @return {!Promise}
     */
    _updateDescription(desc, e) {
      const target = Polymer.dom(e).rootTarget;
      if (target) { target.disabled = true; }
      const rev = this.getRevisionByPatchNum(this.change.revisions,
          this.patchNum);
      const sha = this._getPatchsetHash(this.change.revisions, rev);
      return this.$.restAPI.setDescription(this.changeNum, this.patchNum, desc)
          .then(res => {
            if (res.ok) {
              if (target) { target.disabled = false; }
              this.set(['_change', 'revisions', sha, 'description'], desc);
              this._patchsetDescription = desc;
            }
          }).catch(err => {
            if (target) { target.disabled = false; }
            return;
          });
    },

    _computePrefsButtonHidden(prefs, loggedIn) {
      return !loggedIn || !prefs;
    },


    _fileListActionsVisible(shownFileCount, maxFilesForBulkActions) {
      return shownFileCount <= maxFilesForBulkActions;
    },

    _handlePatchChange(e) {
      const {basePatchNum, patchNum} = e.detail;
      if (this.patchNumEquals(basePatchNum, this.basePatchNum) &&
          this.patchNumEquals(patchNum, this.patchNum)) { return; }
      Gerrit.Nav.navigateToChange(this.change, patchNum, basePatchNum);
    },

    _handlePrefsTap(e) {
      e.preventDefault();
      this.fire('open-diff-prefs');
    },

    _handleDownloadTap(e) {
      e.preventDefault();
      this.fire('open-download-dialog');
    },

    _computeEditLoadedClass(editLoaded) {
      return editLoaded ? 'editLoaded' : '';
    },

    _computePatchInfoClass(patchNum, allPatchSets) {
      if (this.patchNumEquals(patchNum, this.EDIT_NAME)) {
        return 'patchInfoEdit';
      }

      const latestNum = this.computeLatestPatchNum(allPatchSets);
      if (this.patchNumEquals(patchNum, latestNum)) {
        return '';
      }
      return 'patchInfoOldPatchSet';
    },

    _getRevisionInfo(change) {
      return new Gerrit.RevisionInfo(change);
    },
  });
})();
