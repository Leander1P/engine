pc.extend(pc, function () {
/**
     * @name pc.LightComponentSystem
     * @constructor Create a new LightComponentSystem.
     * @class A Light Component is used to dynamically light the scene.
     * @param {pc.Application} app The application.
     * @extends pc.ComponentSystem
     */
    var LightComponentSystem = function (app) {
        this.id = 'light';
        this.description = "Enables the Entity to emit light."
        app.systems.add(this.id, this);

        this.ComponentType = pc.LightComponent;
        this.DataType = pc.LightComponentData;

        this.schema = [
            'enabled',
            'type',
            'color',
            'intensity',
            'castShadows',
            'shadowDistance',
            'shadowResolution',
            'shadowBias',
            'normalOffsetBias',
            'range',
            'falloffMode',
            'shadowType',
            'shadowUpdateMode',
            'mask',
            'innerConeAngle',
            'outerConeAngle',
            'light',
            'model'
        ];

        this.implementations = {};
        this.on('remove', this.onRemove, this);
        pc.ComponentSystem.on('toolsUpdate', this.toolsUpdate, this);
    };

    LightComponentSystem = pc.inherits(LightComponentSystem, pc.ComponentSystem);

    pc.extend(LightComponentSystem.prototype, {
        initializeComponentData: function (component, _data, properties) {
            // duplicate because we're modifying the data
            var data = pc.extend({}, _data);

            if (!data.type) {
                data.type = component.data.type;
            }

            component.data.type = data.type;

            if (data.color && pc.type(data.color) === 'array') {
                data.color = new pc.Color(data.color[0], data.color[1], data.color[2]);
            }

            if (data.enable) {
                console.warn("WARNING: enable: Property is deprecated. Set enabled property instead.");
                data.enabled = data.enable;
            }

            var implementation = this._createImplementation(data.type);
            implementation.initialize(component, data);

            properties = ['type', 'light', 'model', 'enabled', 'color', 'intensity', 'range', 'falloffMode', 'innerConeAngle', 'outerConeAngle', 'castShadows', 'shadowDistance', 'shadowResolution', 'shadowUpdateMode', 'shadowBias', 'normalOffsetBias'];
            LightComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        _createImplementation: function (type) {
            var implementation = this.implementations[type];
            if (!implementation) {
                switch (type) {
                    case 'directional':
                        implementation = new DirectionalLightImplementation(this);
                        break;
                    case 'point':
                        implementation = new PointLightImplementation(this);
                        break;
                    case 'spot':
                        implementation = new SpotLightImplementation(this);
                        break;
                    default:
                        throw new Error("Invalid light type: " + type);
               }

               this.implementations[type] = implementation;
            }

            return implementation;
        },

        onRemove: function (entity, data) {
           this.implementations[data.type].remove(entity, data);
        },

        cloneComponent: function (entity, clone) {
            var light = entity.light;

            // create new data block for clone
            var data = {
                type: light.type,
                enabled: light.enabled,
                color: [light.color.r, light.color.g, light.color.b],
                intensity: light.intensity,
                range: light.range,
                innerConeAngle: light.innerConeAngle,
                outerConeAngle: light.outerConeAngle,
                castShadows: light.castShadows,
                shadowDistance: light.shadowDistance,
                shadowResolution: light.shadowResolution,
                falloffMode: light.falloffMode,
                shadowUpdateMode: light.shadowUpdateMode,
                shadowBias: light.shadowBias,
                normalOffsetBias: light.normalOffsetBias
            };

            this.addComponent(clone, data);
        },

        toolsUpdate: function (fn) {
            var components = this.store;
            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var entity = components[id].entity;
                    var componentData = components[id].data;
                    var implementation = this.implementations[componentData.type];
                    if (implementation) {
                        implementation.toolsUpdate(componentData);
                    }
                }
            }
        },

        changeType: function (component, oldType, newType) {
            this.implementations[oldType].remove(component.entity, component.data);
            this._createImplementation(newType).initialize(component, component.data);
        }
    });

    /**
    * Light implementations
    */

    LightComponentImplementation = function (system) {
        this.system = system;
    };

    LightComponentImplementation.prototype = {
        initialize: function (component, data) {
            var light = new pc.Light();
            light.setType(this._getLightType());
            light._node = component.entity;

            var app = this.system.app;
            app.scene.addLight(light);

            data = data || {};
            data.light = light;

            if (this.system._inTools) {
                this._createDebugShape(component, data, light);
            }
        },

        _getLightType: function () {
            return undefined;
        },

        _createDebugShape: function (component, data, light) {
            this.mesh = this._createDebugMesh();
            if (!this.material) {
                this.material = this._createDebugMaterial();
            }

            var model = new pc.Model();
            model.graph = component.entity;
            model.meshInstances = [ new pc.MeshInstance(component.entity, this.mesh, this.material) ];

            data.model = model;
        },

        _createDebugMesh: function () {
            return undefined;
        },

        _createDebugMaterial: function () {
            return undefined;
        },

        remove: function(entity, data) {
            var app = this.system.app;

            app.scene.removeModel(data.model);
            delete data.model;

            app.scene.removeLight(data.light);

            if (this.system._inTools) {
                app.scene.removeModel(data.model);
                delete data.model;
            }
        },

        toolsUpdate: function (data) {
        }
    };

    /**
    * Directional Light implementation
    */

    DirectionalLightImplementation = function (system) {};
    DirectionalLightImplementation = pc.inherits(DirectionalLightImplementation, LightComponentImplementation);
    DirectionalLightImplementation.prototype = pc.extend(DirectionalLightImplementation.prototype, {
        _getLightType: function() {
            return pc.LIGHTTYPE_DIRECTIONAL;
        },

        _createDebugMesh: function () {
            if (this.mesh) {
                return this.mesh;
            }

            var app = this.system.app;
            var format = new pc.VertexFormat(app.graphicsDevice, [
                { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.ELEMENTTYPE_FLOAT32 }
            ]);

            // Generate the directional light arrow vertex data
            vertexData = [
                // Center arrow
                0, 0, 0, 0, -8, 0,       // Stalk
                -0.5, -8, 0, 0.5, -8, 0, // Arrowhead base
                0.5, -8, 0, 0, -10, 0,   // Arrowhead tip
                0, -10, 0, -0.5, -8, 0,  // Arrowhead tip
                // Lower arrow
                0, 0, -2, 0, -8, -2,         // Stalk
                -0.25, -8, -2, 0.25, -8, -2, // Arrowhead base
                0.25, -8, -2, 0, -10, -2,    // Arrowhead tip
                0, -10, -2, -0.25, -8, -2,    // Arrowhead tip
                // Lower arrow
                0, 0, 2, 0, -8, 2,         // Stalk
                -0.25, -8, 2, 0.25, -8, 2, // Arrowhead base
                0.25, -8, 2, 0, -10, 2,    // Arrowhead tip
                0, -10, 2, -0.25, -8, 2    // Arrowhead tip
            ];
            var rot = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 120);
            var i;
            for (i = 0; i < 24; i++) {
                var pos = new pc.Vec3(vertexData[(i+8)*3], vertexData[(i+8)*3+1], vertexData[(i+8)*3+2]);
                var posRot = rot.transformPoint(pos, pos);
                vertexData[(i+24)*3]   = posRot[0];
                vertexData[(i+24)*3+1] = posRot[1];
                vertexData[(i+24)*3+2] = posRot[2];
            }
            // Copy vertex data into the vertex buffer
            var vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, format, 32);
            var positions = new Float32Array(vertexBuffer.lock());
            for (i = 0; i < vertexData.length; i++) {
                positions[i] = vertexData[i];
            }
            vertexBuffer.unlock();
            var mesh = new pc.Mesh();
            mesh.vertexBuffer = vertexBuffer;
            mesh.indexBuffer[0] = null;
            mesh.primitive[0].type = pc.PRIMITIVE_LINES;
            mesh.primitive[0].base = 0;
            mesh.primitive[0].count = vertexBuffer.getNumVertices();
            mesh.primitive[0].indexed = false;
            return mesh;
        },

        _createDebugMaterial: function () {
            var material = new pc.BasicMaterial();
            material.color = new pc.Color(1, 1, 0, 1);
            material.update();
            return material;
        }

    });

    /**
    * Point Light implementation
    */

    PointLightImplementation = function (system) {};
    PointLightImplementation = pc.inherits(PointLightImplementation, LightComponentImplementation);
    PointLightImplementation.prototype = pc.extend(PointLightImplementation.prototype, {
        _getLightType: function() {
            return pc.LIGHTTYPE_POINT;
        },

        _createDebugMesh: function () {
            if (this.mesh) {
                return this.mesh;
            }

            var app = this.system.app;
            return pc.createSphere(app.graphicsDevice, {
                radius: 0.1
            });
        },

        _createDebugMaterial: function () {
            var material = new pc.BasicMaterial();
            material.color = new pc.Color(1, 1, 0, 1);
            material.update();
            return material;
        }

    });


    /**
    * Spot Light implementation
    */

    SpotLightImplementation = function (system) {};
    SpotLightImplementation = pc.inherits(SpotLightImplementation, LightComponentImplementation);
    SpotLightImplementation.prototype = pc.extend(SpotLightImplementation.prototype, {
        _getLightType: function() {
            return pc.LIGHTTYPE_SPOT;
        },

        _createDebugMesh: function () {
            var app = this.system.app;
            var indexBuffer = this.indexBuffer;
            if (!indexBuffer) {
                var indexBuffer = new pc.IndexBuffer(app.graphicsDevice, pc.INDEXFORMAT_UINT8, 88);
                var inds = new Uint8Array(indexBuffer.lock());
                // Spot cone side lines
                inds[0] = 0;
                inds[1] = 1;
                inds[2] = 0;
                inds[3] = 11;
                inds[4] = 0;
                inds[5] = 21;
                inds[6] = 0;
                inds[7] = 31;
                // Spot cone circle - 40 segments
                for (var i = 0; i < 40; i++) {
                    inds[8 + i * 2 + 0] = i + 1;
                    inds[8 + i * 2 + 1] = i + 2;
                }
                indexBuffer.unlock();
                this.indexBuffer = indexBuffer;
            }

            var vertexFormat = new pc.VertexFormat(app.graphicsDevice, [
                { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.ELEMENTTYPE_FLOAT32 }
            ]);

            var vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, vertexFormat, 42, pc.BUFFER_DYNAMIC);

            var mesh = new pc.Mesh();
            mesh.vertexBuffer = vertexBuffer;
            mesh.indexBuffer[0] = indexBuffer;
            mesh.primitive[0].type = pc.PRIMITIVE_LINES;
            mesh.primitive[0].base = 0;
            mesh.primitive[0].count = indexBuffer.getNumIndices();
            mesh.primitive[0].indexed = true;

            return mesh;

        },

        _createDebugMaterial: function () {
            return new pc.BasicMaterial();
        },

        toolsUpdate: function (data) {
            var model = data.model;
            var meshInstance = model.meshInstances[0];
            var vertexBuffer = meshInstance.mesh.vertexBuffer;

            var oca = Math.PI * data.outerConeAngle / 180;
            var ae = data.range;
            var y = -ae * Math.cos(oca);
            var r = ae * Math.sin(oca);

            var positions = new Float32Array(vertexBuffer.lock());
            positions[0] = 0;
            positions[1] = 0;
            positions[2] = 0;
            var numVerts = vertexBuffer.getNumVertices();
            for (var i = 0; i < numVerts-1; i++) {
                var theta = 2 * Math.PI * (i / (numVerts-2));
                var x = r * Math.cos(theta);
                var z = r * Math.sin(theta);
                positions[(i+1)*3+0] = x;
                positions[(i+1)*3+1] = y;
                positions[(i+1)*3+2] = z;
            }
            vertexBuffer.unlock();
        }
    });

    return {
        LightComponentSystem: LightComponentSystem
    };
}());


