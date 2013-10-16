"use strict";

/**
 * Dahuapp editor module.
 *
 * @param   dahuapp     dahuapp object to augment with module.
 * @param   $           jQuery
 * @returns dahuapp extended with editor module.
 */
var dahuapp = (function (dahuapp, $) {
    var editor = (function () {

        var self = {};

        /* private API */

        /*
         * Tells if the app is in the capture mode (in theory, no actions are
         * available in this mode, other than clicking on the capture mode
         * button, or pressing the capture or escape keyboard keys).
         * @type Boolean
         */
        var captureMode = false;

        /*
         * Name of the files used in a project.
         * @type String|String|String|String|String|String
         */
        var jsonFileName = "presentation.dahu";
        var generatedHtmlName = "index.html";
        var generatedJsonName = "presentation.json";
        var buildDir = "build";
        var imgDir = "img";

        /*
         * True when new button was pressed.
         * @type Boolean
         */
        var initProject = false;

        /**
         * True when new changes occurs
         * @type Boolean
         */
        var newChanges = false;

        /*
         * The absolute path of a directory.
         * This directory has the following components (at least) :
         * projectDir
         *      |------- presentation.dahu
         *      |------- screen1.png
         *      |------- ...
         *      |------- screen2.png
         *      |------- build
         *                  |--------- presentation.dahu
         *                  |--------- screen1.png
         *                  |--------- ...
         *                  |--------- screen2.png
         *                  |--------- index.html
         *                  |--------- presentation.css
         *      
         * The default value must be discussed.
         * @type String
         */
        var projectDir = ".";

        /*
         * Selected slide (displayed in the view).
         * -1 means nothing is selected.
         * @type int
         */
        var selectedSlide = -1;

        /*
         * Selected object on the current slide.
         * -1 means nothing is selected.
         * @type int
         */
        var selectedObjectOnSlide = -1;

        /*
         * Private events for the editor.
         */
        var events = (function () {
            var self = {};

            /*
             * Creates a generic event.
             */
            var createEvent = function () {
                var callbacks = $.Callbacks();
                return {
                    publish: callbacks.fire,
                    subscribe: callbacks.add,
                    unsubscribe: callbacks.remove,
                    unsubscribeAll: callbacks.empty
                };
            };

            /*
             * Called when an image on the list has been selected and
             * is different from the previous one.
             */
            self.onSelectedImageChanged = createEvent();

            /*
             * Called when an image is added to the list.
             */
            self.onNewImageTaken = createEvent();

            /*
             * Called when a new projet is created.
             */
            self.onNewProjectCreated = createEvent();

            /*
             * Called when an object is selected.
             */
            self.onSelectedObjectChanged = createEvent();

            /*
             * Called when a popup is confirmed.
             */
            self.onPopupConfirmed = createEvent();

            /*
             * Called when a popup is closed (confirmed, cancelled, or
             * anything else).
             */
            self.onPopupClosed = createEvent();

            return self;
        })();

        /*
         * Instanciates the DahuScreencastModel class.
         */
        var jsonModel;

        /*
         * Instanciates the DahuScreencastGenerator class.
         */
        var generator;

        /*
         * Settings for the application.
         *
         * Saved on disk in ~/.config/dahu/config.json.
         */
        var ApplicationSettingsModel = function () {
            var settings = {};

            var saveSettings = function () {
                var stringJson = JSON.stringify(settings, null, '    ');
                dahuapp.drivers.fileSystem.writeConfigurationFile(stringJson);
            };

            var setDefaultSettings = function () {
                settings.captureKey = "f7";
                settings.defaultWidth = 800;
                settings.defaultHeight = 600;
                settings.defaultSpeed = 0.8;
            };

            this.loadSettings = function () {
                var stringJson = dahuapp.drivers.fileSystem.loadConfigurationFile();
                if (stringJson !== null) {
                    settings = JSON.parse(stringJson);
                } else {
                    setDefaultSettings();
                }
            };

            this.getCaptureKey = function () {
                return settings.captureKey;
            };

            this.setCaptureKey = function (key) {
                settings.captureKey = key;
                saveSettings();
            };

            this.getDefaultWidth = function () {
                return settings.defaultWidth;
            };

            this.getDefaultHeight = function () {
                return settings.defaultHeight;
            };

            this.setDefaultSize = function (w, h) {
                settings.defaultHeight = parseInt(h);
                settings.defaultWidth = parseInt(w);
                // No error checking: should be managed by the WebView
                // since we use input type="number"
                saveSettings();
            };

            this.getDefaultSpeed = function () {
                return settings.defaultSpeed;
            };

            this.setDefaultSpeed = function (s) {
                settings.defaultSpeed = parseFloat(s);
                saveSettings();
            };
        };
        var applicationSettings;

        /*
         * Standard message printers.
         */
        var captureModeAlert = function () {
            alert("Please turn capture mode off\n" +
                "before doing that.");
        };
        var initialiseProjectAlert = function () {
            alert("Please open or create a project\n" +
                "before doing that.");
        };

        /*
         * Functions associated with buttons.
         * The function 'enableProjectButtons' enables all the buttons
         * that are disabled when no project is open.
         */
        var enableProjectButtons = function () {
            $('#capture-mode').parent().show();
            setElementDisabled('#save-project', false);
            setElementDisabled('#reload-project', false);
            setElementDisabled('#clean-project', false);
            setElementDisabled('#generate', false);
            setElementDisabled('#visual-mode', false);
            setElementDisabled('#set-output-image-size', false);
            setElementDisabled('#capture-mode', false);
            if (selectedSlide !== -1) {
                setElementDisabled('#this-slide-up', false);
                setElementDisabled('#this-slide-down', false);
                setElementDisabled('#throw-this-slide', false);
            }
            if (selectedObjectOnSlide !== -1) {
                setElementDisabled('#edit-action');
            }
        };
        var loadFromProjectDir = function () {
            var fileSystem = dahuapp.drivers.fileSystem;
            var jsonFullName = projectDir + fileSystem.getSeparator() + jsonFileName;
            var stringJson = fileSystem.readFile(jsonFullName);
            events.onNewProjectCreated.publish();
            try {
                jsonModel.loadJson(stringJson);
            } catch (e) {
                alert("Cannot parse " + jsonFullName + ":\n" + e
                    + "\nIf you edited the file manually, you may try to validate it with"
                    + " a tool like http://jsonlint.com/ for better syntax errors."
                    + " If you did not edit the file, please report the bug to the Dahu team.");
                setStateBarMessage("Could not load project.");
                return;
            }
            var nbSlides = jsonModel.getNbSlide();
            for (var i = 0; i < nbSlides; i++) {
                events.onNewImageTaken.publish(i);
            }
            selectedSlide = nbSlides - 1;
            events.onSelectedImageChanged.publish(selectedSlide);
            dahuapp.drivers.setTitleProject(projectDir);
            initProject = true;
            newChanges = false;
            setStateBarMessage("Project successfully loaded.");
        };
        var createFromProjectDir = function () {
            var width = applicationSettings.getDefaultWidth();
            var height = applicationSettings.getDefaultHeight();
            jsonModel.createPresentation(width, height);
            dahuapp.drivers.setTitleProject(projectDir);
            dahuapp.drivers.logger.JSinfo("dahuapp.editor.js", "init", "project created !");
            initProject = true;
            newChanges = false;
            selectedSlide = -1;
            selectedObjectOnSlide = -1;
            events.onNewProjectCreated.publish();
            setStateBarMessage("New project created. Click 'Capture mode' to start adding slides.");
        };
        var openProject = function () {
            var choice = prompt("Enter the absolute path to the dahu project directory :",
                "Dahu project directory.");
            //choice = dahuapp.drivers.fileSystem.askForProjectDir();
            if (choice !== null) {
                var fileSystem = dahuapp.drivers.fileSystem;
                var absolutePath = choice + fileSystem.getSeparator() + jsonFileName;
                if (!fileSystem.exists(absolutePath)) {
                    alert("The following file :\n\n" + absolutePath +
                        "\n\ndoesn't exist. Please create a new project,\n" +
                        "or specify a valid dahu project directory.");
                    return;
                }
                projectDir = choice;
                loadFromProjectDir();
                enableProjectButtons();
            }
        };
        var newProject = function () {
            var choice = prompt("Enter the absolute path of the project directory :",
                "Dahu project directory.");
            //choice = dahuapp.drivers.fileSystem.askForProjectDir();
            if (choice !== null) {
                var fileSystem = dahuapp.drivers.fileSystem;
                if (!fileSystem.exists(choice)) {
                    if (!fileSystem.create(choice)) {
                        alert("The directory couldn't be created.\n"
                            + "Maybe it's an issue with rights.");
                        return;
                    } else {
                        setStateBarMessage("Project " + choice + " created");
                    }
                } else {
                    alert("This directory already exists.\n" +
                        "It's not a problem, but be careful !");
                }
                projectDir = choice;
                createFromProjectDir();
            }
        };
        var cleanProjectDirectory = function () {
            var fileSystem = dahuapp.drivers.fileSystem;
            var completeBuildDir = projectDir + fileSystem.getSeparator() + buildDir;
            if (fileSystem.exists(completeBuildDir)) {
                if (!fileSystem.remove(completeBuildDir)) {
                    alert("Error, the build directory couldn't\n" +
                        "be removed.");
                    return;
                }
            }
        };
        var generateProject = function () {
            var fileSystem = dahuapp.drivers.fileSystem;
            var sep = fileSystem.getSeparator();
            var completeBuildDir = projectDir + sep + buildDir;
            if (!fileSystem.create(completeBuildDir)) {
                alert("Error, the build directory couldn't\n" +
                    "be created.");
                return;
            }
            // create img directory and adds the final forms of the images
            var absImgDir = completeBuildDir + sep + imgDir;
            fileSystem.create(absImgDir);
            var imgDim = fileSystem.copyAndResizeImages(projectDir + sep + imgDir, absImgDir,
                jsonModel.getImageWidth(), jsonModel.getImageHeight());
            // generates the json and html
            var jsonGen = generator.generateJsonString(jsonModel, imgDim);
            var cssGen = generator.generateCssString(jsonModel); // @warning in the future css must not be embedded in the html !
            var htmlGen = generator.generateHtmlString(jsonModel, jsonGen, cssGen);
            // write the generated json and html
            fileSystem.writeFile(completeBuildDir + sep + generatedHtmlName, htmlGen);

            // Writing the JSON file is not needed as we hardcode the
            // value in the HTML file. Uncommenting the following line
            // will get the file back if ever needed:
            //fileSystem.writeFile(completeBuildDir + sep + generatedJsonName, jsonGen);

            // copies the script files into the build directory
            fileSystem.copyFile(fileSystem.getResource("dahuapp.viewer.js"), completeBuildDir + sep + "dahuapp.viewer.js");
            fileSystem.copyFile(fileSystem.getResource("dahuapp.viewer.css"), completeBuildDir + sep + "dahuapp.viewer.css");
            fileSystem.copyFile(fileSystem.getResource("dahuapp.js"), completeBuildDir + sep + "dahuapp.js");
            fileSystem.copyFile(fileSystem.getResource("parse-search.js"), completeBuildDir + sep + "parse-search.js");
            fileSystem.copyFile(fileSystem.getResource("cursor.png"), completeBuildDir + sep + imgDir + sep + "cursor.png");
            fileSystem.copyFile(fileSystem.getResource("cursor-pause.png"), completeBuildDir + sep + imgDir + sep + "cursor-pause.png");
        };
        var runPreview = function () {
            var sep = dahuapp.drivers.fileSystem.getSeparator();
            var target = projectDir + sep + buildDir + sep + generatedHtmlName;
            dahuapp.drivers.browser.runPreview(target);
        };

        /*
         * Changes the capture mode (if true => false, if false => true).
         */
        var switchCaptureMode = function () {
            // shortcut
            var keyboardDriver = dahuapp.drivers.keyboard;
            // if we're in capture mode, we exit it, otherwise we enter it
            if (!captureMode) {
                keyboardDriver.addKeyListener(self.handleCaptureModeEvent);
                setStateBarMessage("Capture mode ON (" +
                    applicationSettings.getCaptureKey().toUpperCase() +
                    " to take a screenshot / ESC to exit capture mode)");
            } else {
                keyboardDriver.removeKeyListener(self.handleCaptureModeEvent);
                setStateBarMessage("Capture mode OFF");
            }
            // the capture mode button gets a different style
            $('#capture-mode').toggleClass('btn-primary');
            $('#capture-mode').toggleClass('btn-danger');
            captureMode = !captureMode;
            // change the look of disabled buttons
            setElementDisabled('#new-project', captureMode);
            setElementDisabled('#open-project', captureMode);
            setElementDisabled('#save-project', captureMode);
            setElementDisabled('#reload-project', captureMode);
            setElementDisabled('#clean-project', captureMode);
            setElementDisabled('#generate', captureMode);
            setElementDisabled('#visual-mode', captureMode);
            setElementDisabled('#set-capture-key', captureMode);
            setElementDisabled('#set-output-image-size', captureMode);
            actualiseObjectButtonsState();
            if (captureMode) {
                dahuapp.drivers.logger.JSconfig("dahuap.editor.js", "switchCaptureMode", "capture mode on");
            } else {
                dahuapp.drivers.logger.JSconfig("dahuap.editor.js", "switchCaptureMode", "capture mode off");
            }
        };

        /*
         * Functions to update the preview on the middle.
         */
        var updatePreview = function (idSlide) {
            cleanPreview();
            if (idSlide === -1) {
                return;
            }
            var img = jsonModel.getSlide(idSlide).object[0].img;
            var sep = dahuapp.drivers.fileSystem.getSeparator();
            var abs = projectDir + sep + img;

            $('#preview-image').append($(document.createElement('li'))
                .append($(document.createElement('img'))
                    .attr({'src': 'file:' + abs, 'alt': abs, 'id': "image"})));
            updateActions(idSlide);
        };
        var updateActions = function (idSlide) {
            var actionList = jsonModel.getActionList(idSlide);
            for (var i = 0; i < actionList.length; i++) {
                var action = actionList[i];
                if (action.target === "mouse-cursor") {
                    addMouseOnPreview(action.finalAbs, action.finalOrd, i);
                }
            }
        };
        var addMouseOnPreview = function (mouseXp, mouseYp, idAction) {
            var resourceCursor = dahuapp.drivers.fileSystem.getResource("cursor.png");
            $("#preview-image").append($(document.createElement('li'))
                .attr({ 'class': "my-cursor",
                    'id': idAction
                })
                .append($(document.createElement('img'))
                    .attr({'src': resourceCursor, 'alt': resourceCursor})));
            $('.my-cursor').css({
                'left': mouseXp * 100 + "\%",
                'top': mouseYp * 100 + "\%",
                'cursor': 'move'
            });
        };

        /*
         * Sets the edit panel visible (or hides it if it was visible).
         */
        var editSelectedObject = function () {
            $('#action-editor-container').toggle();
            $('#current-image-container').toggleClass('reduced-image-container');
            $('#current-image-container').toogleClass('extended-image-container');
        };

        /*
         * Methods to activate/unactivate a button/menuitem.
         * This only affects the appearance.
         */
        var setElementDisabled = function (selector, boolean) {
            if ($(selector).is('button')) {
                $(selector).prop('disabled', boolean);
            } else {
                if (boolean) {
                    $(selector).parent().addClass('disabled');
                } else {
                    $(selector).parent().removeClass('disabled');
                }
            }
        };
        /*
         * Enable/disable only buttons that affect a selected slide/object.
         */
        var actualiseSlideButtonsState = function () {
            var disabled = (selectedSlide === -1);
            setElementDisabled('#this-slide-up', disabled);
            setElementDisabled('#this-slide-down', disabled);
            setElementDisabled('#throw-this-slide', disabled);
        };
        var actualiseObjectButtonsState = function () {
            var disabled = (selectedObjectOnSlide === -1) || captureMode;
            setElementDisabled('#edit-action', disabled);
        };

        /*
         * Methods to show/hide a specifid popup.
         * @param {String} popupSelector Id of the popup to show.
         */
        var showPopup = function (popupSelector) {
            $('#popup-manager ' + popupSelector).show();
            $('#popup-manager').show();
        };
        var closePopup = function (popupSelector) {
            $('#popup-manager ' + popupSelector).hide();
            $('#popup-manager').hide();
        };

        /*
         * Functions to change the output image size.
         */
        var setOutputImageSize = function () {
            $('#output-settings-popup #required-width').val(jsonModel.getImageWidth());
            $('#output-settings-popup #required-height').val(jsonModel.getImageHeight());
            showPopup('#output-settings-popup');
            events.onPopupConfirmed.subscribe(getOutputImageSize);
        };
        var getOutputImageSize = function () {
            newChanges = true;
            var reqWidth = $('#required-width').val();
            var reqHeight = $('#required-height').val();
            if (reqWidth === "") {
                reqWidth = 0;
            } else {
                reqWidth = parseInt(reqWidth);
            }
            if (reqHeight === "") {
                reqHeight = 0;
            } else {
                reqHeight = parseInt(reqHeight);
            }
            var fileSystem = dahuapp.drivers.fileSystem;
            var path = projectDir + fileSystem.getSeparator() + jsonModel.getABackgroundImage();
            var dim = fileSystem.getResizedDimensions(path, reqWidth, reqHeight);
            jsonModel.setImageSizeRequirements(dim.width, dim.height);
        };

        /*
         * Functions to set the key used to take a screenshot in capture mode.
         */
        var setCaptureKey = function () {
            $('#set-capture-key-popup #new-capture-key').empty()
                .append(applicationSettings.getCaptureKey().toUpperCase());
            showPopup('#set-capture-key-popup');
            dahuapp.drivers.keyboard.addKeyListener(self.handleChangeCaptureKey);
            events.onPopupConfirmed.subscribe(getCaptureKey);
        };
        var getCaptureKey = function () {
            applicationSettings.setCaptureKey($('#set-capture-key-popup #new-capture-key').html());
            dahuapp.drivers.keyboard.removeKeyListener(self.handleChangeCaptureKey);
        };

        /*
         * User preferences management
         */
        var setUserPrefs = function () {
            $('#user-prefs-popup #default-width').val(applicationSettings.getDefaultWidth());
            $('#user-prefs-popup #default-height').val(applicationSettings.getDefaultHeight());
            $('#user-prefs-popup #default-speed').val(applicationSettings.getDefaultSpeed());
            showPopup('#user-prefs-popup');
            events.onPopupConfirmed.subscribe(saveUserPrefs);
        };

        var saveUserPrefs = function () {
            var defWidth = $('#user-prefs-popup #default-width').val();
            var defHeight = $('#user-prefs-popup #default-height').val();
            applicationSettings.setDefaultSize(defWidth, defHeight);
            var defSpeed = $('#user-prefs-popup #default-speed').val();
            applicationSettings.setDefaultSpeed(defSpeed);
        };

        /*
         * Function to update the image list (when a new one is captured).
         * img is the relative path to the image (relatively to the .dahu file).
         */
        var updateImageList = function (idSlide) {
            if (idSlide === -1) {
                return;
            }
            var img = jsonModel.getSlide(idSlide).object[0].img;
            var abs = projectDir + dahuapp.drivers.fileSystem.getSeparator() + img;
            var $newImage = $(document.createElement('img')).attr({'src': 'file:' + abs, 'alt': abs});
            var $newListElement = $(document.createElement('li'))
                .attr({'class': 'span2 offset'})
                .append($(document.createElement('a'))
                    .attr({'class': 'thumbnail'})
                    .append($newImage));
            var $imageList = $('#image-list > li');
            if ($imageList.length === 0) {
                $('#image-list').append($newListElement);
            } else {
                $($imageList.get(idSlide - 1)).after($newListElement);
            }
        };

        /*
         * Sets an element as selected in the image list.
         * 'selected-image' is a class in case we want to allow
         * multiple selection in a future version of the application.
         */
        var setSelectedOnImageList = function (idSlide) {
            $('#image-list > li').removeClass('selected-image');
            var selectedItem = $('#image-list > li').get(idSlide);
            $(selectedItem).addClass('selected-image');
        };

        /*
         * Sets a selected object on the slide.
         */
        var setSelectedObjectOnSlide = function (idObject) {
            $('#preview-image > li').removeClass('selected-object');
            var selectedObject = $('#preview-image > li').get(idObject);
            $(selectedObject).addClass('selected-object');
        };

        /*
         * Centers all the popups on the screen.
         */
        var centerPopups = function () {
            var width = dahuapp.drivers.getWindowWidth();
            var height = dahuapp.drivers.getWindowHeight();
            $('#popup-manager').children().not('#modal-popups').each(function () {
                var left = (width - $(this).width()) / 2;
                // minus 30 for the toplevel bar
                var top = (height - $(this).height() - 40) / 2;
                $(this).css({
                    'left': left + 'px',
                    'top': top + 'px'
                });
            });
        };

        /*
         * State bar management functions.
         */
        var setStateBarMessage = function (message) {
            removeStateBarMessage();
            $('#state-bar-container').append(message);
        };

        /*
         * Removes the message in the state bar.
         */
        var removeStateBarMessage = function () {
            $('#state-bar-container').empty();
        };

        /*
         * Cleaning functions.
         */
        var cleanImageList = function () {
            $('#image-list').empty();
        };
        var cleanPreview = function () {
            $('#preview-image').empty();
        };

        /*
         * Removes the selected slide.
         * Also removes the image if no other slide has the same one.
         */
        var removeSelectedSlide = function () {
            var selectedItem = $('#image-list > li').get(selectedSlide);
            var image = $(selectedItem).find('img').attr('src');
            $(selectedItem).remove();
            jsonModel.removeSlide(selectedSlide);

            // if the image is no longer used, we delete it
            var imageList = jsonModel.getImageList();
            if (imageList.indexOf(image) === -1) {
                dahuapp.drivers.fileSystem.remove(image);
            }

            if (jsonModel.getNbSlide() === selectedSlide) {
                selectedSlide--;
            }
            newChanges = true;
            events.onSelectedImageChanged.publish(selectedSlide);
        };

        /*
         * Move the selected slide (up or down).
         */
        var moveSelectedSlideUp = function () {
            if (selectedSlide > 0) {
                jsonModel.invertSlides(selectedSlide, selectedSlide - 1);
                var selectedItem = $('#image-list > li').get(selectedSlide);
                $(selectedItem).remove();
                var previousItem = $('#image-list > li').get(selectedSlide - 1);
                $(previousItem).before(selectedItem);
                selectedSlide--;
                newChanges = true;
            }
        };
        var moveSelectedSlideDown = function () {
            if (selectedSlide < jsonModel.getNbSlide() - 1) {
                jsonModel.invertSlides(selectedSlide, selectedSlide + 1);
                var selectedItem = $('#image-list > li').get(selectedSlide);
                $(selectedItem).remove();
                var nextItem = $('#image-list > li').get(selectedSlide);
                $(nextItem).after(selectedItem);
                selectedSlide++;
                newChanges = true;
            }
        };

        /* UUID generation */
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        };

        function guid() {
            return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                s4() + '-' + s4() + s4() + s4();
        }

        /* public API */

        /*
         * Event handlers
         ****************
         * For each handler, put a function name (the same as the key for example).
         * Anonymous functions can't be called from the driver,
         * because Java7 doesn't handle JSObjects well, so it only records the name.
         */

        /*
         * Handle events relative to the capture mode.
         * Other events will be ignored.
         * 
         * Can be eventually set private if JSObject can be memorized by java.
         * 
         * @param int key Key that caused the event.
         */
        self.handleCaptureModeEvent = function handleCaptureModeEvent(keyCode, keyName) {
            // shortcuts
            switch (keyName.toLowerCase()) {
                case applicationSettings.getCaptureKey().toLowerCase():
                    var fileSystem = dahuapp.drivers.fileSystem;
                    var sep = fileSystem.getSeparator();
                    // creation of imgDir if it doesn't exist
                    var imgDirAbsolute = projectDir + sep + imgDir;
                    if (!fileSystem.exists(imgDirAbsolute)) {
                        if (!fileSystem.create(imgDirAbsolute)) {
                            alert("Impossible to create image directory.");
                            return;
                        }
                    }
                    var slideId = guid();
                    var img = dahuapp.drivers.screen.takeScreen(imgDirAbsolute, slideId);
                    var imgRelative = imgDir + sep + img;
                    var mouse = dahuapp.drivers.mouse;
                    // the new screen shot is inserted just after the current slide
                    selectedSlide++;
                    jsonModel.addSlide(selectedSlide, slideId, imgRelative, mouse.getMouseX(), mouse.getMouseY(),
                        applicationSettings.getDefaultSpeed());
                    events.onNewImageTaken.publish(selectedSlide);
                    events.onSelectedImageChanged.publish(selectedSlide);
                    newChanges = true;
                    break;
                case "escape":
                    switchCaptureMode();
                    break;
            }
        };

        /*
         * Handle events for the changing of the capture key.
         * This callback handles key pressed events for all keys except "escape".
         */
        self.handleChangeCaptureKey = function handleChangeCaptureKey(key, name) {
            switch (name.toLowerCase()) {
                case "escape":
                    // nothing
                    break;
                default:
                    $('#set-capture-key-popup #new-capture-key').empty()
                        .append(name.toUpperCase());
                    break;
            }
        };

        self.openOrCreateProject = function openOrCreateProject(dir) {
            projectDir = dir;
            var fileSystem = dahuapp.drivers.fileSystem;
            if (fileSystem.exists(dir) && !fileSystem.isDirectory(dir)) {
                alert("Error: " + dir + " is not a directory");
                return;
            }
            if (fileSystem.exists(dir + "/presentation.dahu")) {
                loadFromProjectDir();
                enableProjectButtons();
            } else {
                createFromProjectDir();
            }
        };

        /*
         * Main function : by calling this function, we bind the
         * html components of the application with their behaviour.
         * So this function must be called once when the html is loaded
         * in the application window.
         */
        self.init = function init() {
            /*
             * Instanciation of the JSON model and the generator.
             */
            jsonModel = dahuapp.createScreencastModel();
            generator = dahuapp.createScreencastGenerator();

            /*
             * Get the application settings.
             */
            applicationSettings = new ApplicationSettingsModel();
            applicationSettings.loadSettings();

            /*
             * Private events callbacks subscribals.
             */
            events.onSelectedImageChanged.subscribe(updatePreview);
            events.onSelectedImageChanged.subscribe(actualiseSlideButtonsState);
            events.onSelectedImageChanged.subscribe(actualiseObjectButtonsState);
            events.onSelectedImageChanged.subscribe(setSelectedOnImageList);
            events.onNewImageTaken.subscribe(updateImageList);
            events.onNewProjectCreated.subscribe(cleanImageList);
            events.onNewProjectCreated.subscribe(cleanPreview);
            events.onNewProjectCreated.subscribe(enableProjectButtons);
            events.onNewProjectCreated.subscribe(actualiseSlideButtonsState);
            events.onNewProjectCreated.subscribe(actualiseObjectButtonsState);
            events.onSelectedObjectChanged.subscribe(setSelectedObjectOnSlide);
            events.onSelectedObjectChanged.subscribe(actualiseObjectButtonsState);
            events.onPopupClosed.subscribe(closePopup);

            /*
             * Private variable for the drag and drop
             */
            var cursorX, cursorY, oldPosX, oldPosY;
            var idAction;

            /*
             * Basic events for the buttons and components.
             */
            //$('body').on('dragstart drop', function() {
            // - This function is to avoid exceptions when dragging elements
            //   on the webview (e.g. the preview or the images on the list).
            //   The webview doesn't support image dragging, so we desactivate
            //   it in the whole page.
            // - If a drag & drop system have to be implemented, this event
            //   will probably have to be removed.
            //    return false;
            //});
            centerPopups();
            $('#image-list').on('click', 'li', function () {
                var imgId = $(this).index();
                if (selectedSlide !== imgId) {
                    selectedSlide = imgId;
                    selectedObjectOnSlide = -1;
                    events.onSelectedImageChanged.publish(selectedSlide);
                }
            });
            $('#preview-image').on('click', 'li', function () {
                var objId = $(this).index();
                if (selectedObjectOnSlide !== objId) {
                    selectedObjectOnSlide = objId;
                    events.onSelectedObjectChanged.publish(selectedObjectOnSlide);
                }
            });
            $('#preview-image').on({
                dragstart: function () {
                    if ($(this).hasClass('my-cursor')) {
                        idAction = $(this).attr('id');
                        oldPosX = $(this).css('left');
                        oldPosY = $(this).css('top');
                    }
                },
                dragover: function () {
                    if ($(this).hasClass('my-cursor')) {
                        return;
                    }
                    cursorY = ((event.y - $(this).offset().top) / $('#image').height());
                    cursorX = ((event.x - $(this).offset().left) / $('#image').width());
                    $('.my-cursor').css({
                        'top': cursorY * 100 + "\%",
                        'left': cursorX * 100 + "\%"
                    });
                    jsonModel.editMouse(selectedSlide, idAction, cursorX, cursorY);
                    setStateBarMessage("x : " + cursorX * 100 + "\%, y : " + cursorY * 100 + "\%");
                },
                dragend: function () {
                    if ($(this).hasClass('my-cursor')) {
                        jsonModel.editMouse(selectedSlide, idAction, cursorX / 100, cursorY / 100);
                        dahuapp.drivers.logger.JSconfig("dahuapp.editor.js",
                            "dragend",
                            "[idSlide : " + selectedSlide +
                                "; idAction : " + idAction +
                                "] mouse cursor moved from " +
                                oldPosX + ", " + oldPosY + "to " +
                                cursorX + ", " + cursorY);
                    }
                }
            }, 'li');
            $('#capture-mode').click(function () {
                if (initProject) {
                    switchCaptureMode();
                }
            });
            $('#save-project').click(function () {
                if (initProject && !captureMode) {
                    var stringJson = jsonModel.getJson();
                    var fileSystem = dahuapp.drivers.fileSystem;
                    var sep = fileSystem.getSeparator();
                    if (fileSystem.writeFile(projectDir + sep + jsonFileName, stringJson)) {
                        dahuapp.drivers.logger.JSinfo("dahuapp.editor.js", "init", "project saved in " + projectDir);
                        setStateBarMessage("Saved in " + projectDir + " successfully");
                        newChanges = false;
                    } else {
                        alert("There's been a problem.\n" +
                            "The project hasn't been saved.");
                        dahuapp.drivers.logger.JSsevere("dahuapp.editor.js", "init", "failed to save project in " + projectDir);
                    }
                }
            });
            $('#open-project').click(function () {
                if (!captureMode) {
                    if (newChanges) {
                        var discard = confirm("There are unsaved changes.\n" +
                            "Discard them and still open a project ?");
                        if (discard) {
                            openProject();
                        }
                    } else {
                        openProject();
                    }
                }
            });
            $('#reload-project').click(function () {
                if (!captureMode) {
                    if (newChanges) {
                        var discard = confirm("There are unsaved changes.\n" +
                            "Discard them and still reload the 'dahu' file ?");
                        if (discard) {
                            loadFromProjectDir();
                        }
                    } else {
                        loadFromProjectDir();
                    }
                }
            });
            $('#new-project').click(function () {
                if (!captureMode) {
                    if (newChanges) {
                        var discard = confirm("There are unsaved changes.\n" +
                            "Discard them and still open a project ?");
                        if (discard) {
                            newProject();
                        }
                    } else {
                        newProject();
                    }
                }
            });
            $('#exit').click(function () {
                if (newChanges) {
                    if (confirm('Quit without saving any changes ?')) {
                        dahuapp.drivers.exit();
                    }
                } else {
                    dahuapp.drivers.exit();
                }
            });
            $('#clean-project').click(function () {
                if (!captureMode && initProject) {
                    cleanProjectDirectory();
                    setStateBarMessage("Build directory cleaned");
                }
            });
            $('#generate').click(function () {
                if (!captureMode && initProject) {
                    if (newChanges) {
                        alert('Please save your project before generating it.');
                    } else {
                        cleanProjectDirectory();
                        generateProject();
                        setStateBarMessage("Project successfully built");
                    }
                }
            });
            $('#visual-mode').click(function () {
                if (!captureMode && initProject) {
                    var fileSystem = dahuapp.drivers.fileSystem;
                    var sep = fileSystem.getSeparator();
                    if (!fileSystem.exists(projectDir + sep + buildDir)) {
                        alert('Please generate your project before.');
                    } else {
                        runPreview();
                    }
                }
            });
            $('#throw-this-slide').click(removeSelectedSlide);
            $('#this-slide-up').click(moveSelectedSlideUp);
            $('#this-slide-down').click(moveSelectedSlideDown);
            $('#edit-action').click(editSelectedObject);
            $('.popup-confirm').click(function () {
                events.onPopupConfirmed.publish();
                events.onPopupConfirmed.unsubscribeAll();
                events.onPopupClosed.publish('#' + $(this).parent().parent().attr('id'));
            });
            $('.popup-cancel').click(function () {
                events.onPopupConfirmed.unsubscribeAll();
                events.onPopupClosed.publish('#' + $(this).parent().parent().attr('id'));
            });
            $('#set-output-image-size').click(function () {
                if (!captureMode && initProject) {
                    setOutputImageSize();
                }
            });
            $('#set-capture-key').click(function () {
                if (!captureMode) {
                    setCaptureKey();
                }
            });
            $('#set-user-prefs').click(function () {
                if (!captureMode) {
                    setUserPrefs();
                }
            });
            $('#about-us').click(function () {
                showPopup('#about-us-popup');
            });
            $('#online-help').click(function () {
                dahuapp.drivers.browser.openURL("https://github.com/dahuapp/Dahu/wiki/_pages");
            });
            $(window).resize(function () {
                centerPopups();
            });
        };

        return self;
    })();

    dahuapp.editor = editor;

    return dahuapp;
})(dahuapp || {}, jQuery);