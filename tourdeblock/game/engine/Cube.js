﻿/// <reference path="engine/ApplyImpulses.js" />
/// <reference path="engine/ApplyImpulsesOCL.js" />
/// <reference path="engine/Cube.js" />
/// <reference path="engine/CubeCollision.js" />
/// <reference path="engine/CubeCollisionOCL.js" />
/// <reference path="engine/VectMath.js" />
/// <reference path="CamControl.js" />
/// <reference path="GameLevelLoader.js" />
/// <reference path="LevelManagement.js" />
/// <reference path="CamControl.js" />

/*
   Tour de Block
Designed by Indigo Kelleigh, Developed by Vance Feldman, Original c++ engine by Ben Kenwright

Copyright (c) 2012, Intel Corporation
All rights reserved.
 
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
 
    - Redistributions of source code must retain the above copyright notice,
      this list of conditions and the following disclaimer.
    - Redistributions in binary form must reproduce the above copyright notice,
      this list of conditions and the following disclaimer in the documentation
and/or other materials provided with the distribution.
 
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
    SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
THE POSSIBILITY OF SUCH DAMAGE.
*/


Vec3 = function (x, y, z) {

    if (x == null || x == undefined) x = 0;
    if (y == null || y == undefined) y = 0;
    if (z == null || z == undefined) z = 0;

    this.flat = [x, y, z];

}

Vec3.prototype.flat = [0, 0, 0];

var Mat4 = function() {
    return [1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1];
}



    // sleeping epsilon is now set when a level is loaded and when the first bullet is fired
    g_sleepEpsilon = .25; // 0 to disable, 0.05f for test value
    g_startSleeping = true; // Declared in Cube.cpp



    Cube = function (
        /*vec3*/pos,
        /*vec3*/rot,
        /*vec3*/size,
        /*float*/mass) {



        /*public:*/
        /*D3DXVECTOR3*/this.m_c = pos; 		                                    // Center Of Cube (world center)
        /*D3DXVECTOR3*/this.m_u = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];            // Array with 3 instances of Vec3 Local x-y-z Axes
        /*D3DXVECTOR3*/this.m_e = [0, 0, 0]; 		                            // Positive halfwidths along each axis

        /*D3DXMATRIX*/this.m_matWorld = Mat4();
        /*D3DXQUATERNION*/this.m_rot = new Quaternion();

        this.m_rot = quat_setFromEuler(rot);            //<--- Starting state rotation
        this.m_rot = quat_normalize(this.m_rot);

        /*float*/this.m_mass = 1;
        /*D3DXMATRIX*/this.m_boxInertia = new Mat4();
        /*D3DXMATRIX*/this.m_invInertia = new Mat4();


        /*D3DXVECTOR3*/this.m_linVelocity = [0, 0, 0];
        /*D3DXVECTOR3*/this.m_angVelocity = [0, 0, 0];

        this.m_velocityAverage = [0, 0, 0];

        this.m_mass = mass;

        /*D3DXVECTOR3*/this.m_forces = [0, 0, 0];
        /*D3DXVECTOR3*/this.m_torques = [0, 0, 0];


        /*float*/this.m_radius = 1;
        /*float*/this.m_rwaMotion = 2 * g_sleepEpsilon;
        /*bool (int) */this.m_awake;

        this.m_e[0] = size[0] * .5;
        this.m_e[1] = size[1] * .5;
        this.m_e[2] = size[2] * .5;

        // If we want our objects to start awake or sleeping
        if (g_startSleeping) {
            this.m_rwaMotion = 0;
            this.m_awake = 0;
        } else {
            this.m_rwaMotion = 2 * g_sleepEpsilon;
            this.m_awake = 1;
        }

        this.m_penHistory = 0;

        this.m_radius = (Math.sqrt(this.m_e[0] * this.m_e[0] + this.m_e[1] * this.m_e[1] + this.m_e[2] * this.m_e[2])) - .1;

        this.needsMatrixUpdate = true;

        //UpdateMatrix();
    }

    UpdateMatrix = function (index) {

        var matR = new Mat4();

        CubeList._m_rot[index] = quat4_normalize(CubeList._m_rot[index]);

        matR = mat4_setRotationFromQuaternion(matR, CubeList._m_rot[index]);

        CubeList._m_u[index][0] = [1, 0, 0];
        CubeList._m_u[index][1] = [0, 1, 0];
        CubeList._m_u[index][2] = [0, 0, 1];
        CubeList._m_u[index][0] = vec3_transform_coord(CubeList._m_u[index][0], matR); // rotate the the axis
        CubeList._m_u[index][1] = vec3_transform_coord(CubeList._m_u[index][1], matR);
        CubeList._m_u[index][2] = vec3_transform_coord(CubeList._m_u[index][2], matR);

        // transform the points
        var matT = new Mat4();

        matT = mat4_setTranslation(CubeList._m_c[index][0], CubeList._m_c[index][1], CubeList._m_c[index][2]);  // <----- translate matrix center point

        CubeList._m_matWorld[index] = mat4_mul(matT, matR);  // <------   ORDER IS IMPORTANT T then R


        size = vec3_scale(2, CubeList._m_e[index]);   // multiply half extents by 2 to get the full extents

        // set inertia
        var x2 = (size[0] * size[0]);
        var y2 = (size[1] * size[1]);
        var z2 = (size[2] * size[2]);
        var ix = (y2 + z2) * CubeList._m_mass[index] / 12.0;
        var iy = (x2 + z2) * CubeList._m_mass[index] / 12.0;
        var iz = (x2 + y2) * CubeList._m_mass[index] / 12.0;


        CubeList._m_boxInertia[index] = [ix, 0, 0, 0,
	                                    0, iy, 0, 0,
	                                    0, 0, iz, 0,
	                                    0, 0, 0, 1];

        var temp = Mat4();

        var matRInverse = mat4_inverse(matR);
        var boxInertiaInv = mat4_inverse(CubeList._m_boxInertia[index]);

        var mult = mat4_mul(mat4_inverse(matR), matR);


        var cR = new Mat4();
        var correctedR = mat4_setRotationFromQuaternion(cR, CubeList._m_rot[index]);

        CubeList._m_invInertia[index] = mat4_mul(mat4_mul(matRInverse, boxInertiaInv), matR);

    }



	// temporary until everything is an array
	function setMat4FromArray(mat4ToSet, array) {

	    mat4ToSet.set(  array[0], array[1], array[2], array[3],
                        array[4], array[5], array[6], array[7],
                        array[8], array[9], array[10], array[11],
                        array[12], array[13], array[14], array[15]);
	}



S_STATIC = function () { };

var firstRun = true;
var allTime = 0;

AddCollisionImpulse = function (                    c0,                 //cube index
									                c1,                 //cube index
									                hitPoint,           //vec
									                normal,             //vec
									                dt,                 //f
									                penetration)        //f
{

    c0_m_mass = CubeList._m_mass[c0];
    c1_m_mass = CubeList._m_mass[c1];
    c0_m_c = CubeList._m_c[c0];
    c1_m_c = CubeList._m_c[c1];
    c0_m_awake = CubeList._m_awake[c0];
    c1_m_awake = CubeList._m_awake[c1];

    if (IMPULSE_OCL) {
        return;
        c0_m_linVelocity = CubeList._m_linVelocity.materialize()[c0];
        c1_m_linVelocity = CubeList._m_linVelocity.materialize()[c1];
        c0_m_angVelocity = CubeList._m_angVelocity.materialize()[c0];
        c1_m_angVelocity = CubeList._m_angVelocity.materialize()[c1];
    } else {
        c0_m_linVelocity = CubeList._m_linVelocity[c0];
        c1_m_linVelocity = CubeList._m_linVelocity[c1];
        c0_m_angVelocity = CubeList._m_angVelocity[c0];
        c1_m_angVelocity = CubeList._m_angVelocity[c1];
    }

    c0_m_invInertia = CubeList._m_invInertia[c0];
    c1_m_invInertia = CubeList._m_invInertia[c1];

    CubeList._m_velocityUpdate[c0] = 1;
    CubeList._m_velocityUpdate[c1] = 1;

    // Some simple check code.
    if (dt <= 0.0)       
        return;
    

    var invMass0 = (c0_m_mass > 9999) ? 0.0 : (1.0 / c0_m_mass);
    var invMass1 = (c1_m_mass > 9999) ? 0.0 : (1.0 / c1_m_mass);

    //c0_m_awake == 1 for true;
    invMass0 = c0_m_awake * invMass0;
    invMass1 = c1_m_awake * invMass1;

    // Both objects are non movable
    if ((invMass0 + invMass1) == 0.0) {       
        return;
    }
  

    var r0 = vec3_sub(hitPoint, c0_m_c);
    var r1 = vec3_sub(hitPoint, c1_m_c);

    var v0 = vec3_add(c0_m_linVelocity, vec3_cross(c0_m_angVelocity, r0));
    var v1 = vec3_add(c1_m_linVelocity, vec3_cross(c1_m_angVelocity, r1));

    // Relative Velocity
    var dv = vec3_sub(v0, v1);


    // NORMAL Impulse Code --------------------------------------------------

    // Compute Normal Impulse
    var vn = vec3_dot(dv, normal);

    // Works out the bias to prevent Prevents sinking!
   
    var allowedPenetration = .05;
    var biasFactorValue = .1;

    var inv_dt = dt > 0.0 ? 1.0 / dt : 0.0;
    var bias = biasFactorValue * inv_dt * Math.max(0.0, penetration - allowedPenetration);

   
    var kNormal = invMass0 + invMass1 +

        vec3_dot(
            normal,
            vec3_add(
                vec3_cross(vec3_transform_coord(vec3_cross(r0, normal), c0_m_invInertia), r0),
                vec3_cross(vec3_transform_coord(vec3_cross(r1, normal), c1_m_invInertia), r1)
            )
    );


    var massNormal = 1.0 / kNormal;
    var dPn = massNormal * (-vn + bias);
    dPn = Math.max(dPn, 0.0);
  

    // Apply normal contact impulse
    var P = vec3_scale(dPn, normal);
    
    var mappedResult = vec3_transform_coord(vec3_cross(r0, P), c0_m_invInertia);

    c0_m_linVelocity = vec3_add(c0_m_linVelocity, vec3_scale(invMass0, P));
    c0_m_angVelocity = vec3_add(c0_m_angVelocity, mappedResult);

    c1_m_linVelocity = vec3_sub(c1_m_linVelocity, vec3_scale(invMass1, P));
    c1_m_angVelocity = vec3_sub(c1_m_angVelocity, vec3_transform_coord(vec3_cross(r1, P), c1_m_invInertia));



    // TANGENT  -------------------------------------------------------------------------

    // Work out our tangent vector, which is perpendicular
    // to our collision normal
    var tangent  = vec3_sub(dv, vec3_scale(vec3_dot(dv, normal), normal));
    
    tangent = vec3_normalize(tangent);

    var kTangent = invMass0 + invMass1 +

        vec3_dot(tangent,
        vec3_add(
            vec3_cross(vec3_transform_coord(vec3_cross(r0, tangent), c0_m_invInertia), r0),
            vec3_cross(vec3_transform_coord(vec3_cross(r1, tangent), c1_m_invInertia), r1)
        )
        );

    var massTangent = 1.0 / kTangent;

    var vt = vec3_dot(dv, tangent);
    var dPt = massTangent * (-vt);


    var maxPt = g_friction * dPn;
    dPt = clamp(dPt, -maxPt, maxPt);

   
    // Apply contact impulse
    P = vec3_scale(dPt, tangent);


    var p0 =  vec3_scale(invMass0, P);
    var p1 = vec3_scale(invMass1, P);

    CubeList._m_linVelocity[c0] = vec3_add(c0_m_linVelocity,p0);
    CubeList._m_angVelocity[c0] = vec3_add(c0_m_angVelocity, vec3_transform_coord(vec3_cross(r0, P), c0_m_invInertia));

    CubeList._m_linVelocity[c1] = vec3_sub(c1_m_linVelocity, p1);
    CubeList._m_angVelocity[c1] = vec3_sub(c1_m_angVelocity, vec3_transform_coord(vec3_cross(r1, P), c1_m_invInertia));
        
    

    time++;
}



var debugCubes = new Array();

var DebugDrawCollisionPoints = function () {

    return;

    for (var i = 0; i < debugCubes.length; i++) {

       // sceneThree.remove(debugCubes[i]);
    }
    //debugCubes = new Array();

    for (var i = 0; i < g_numCols; i++) {
        var m_mass0 = CubeList._m_mass[g_CollisionsArray[i].box0];
        var m_mass1 = CubeList._m_mass[g_CollisionsArray[i].box1];
        var numPoints = g_CollisionsArray[i].numPoints;


        for (var k = 0; k < numPoints; k++) {
            var hitPoint = g_CollisionsArray[i].points[k].point;
            var normal = g_CollisionsArray[i].points[k].normal;
            var penDepth = g_CollisionsArray[i].points[k].pen;


            var invMass0 = m_mass0 > 9999 ? 0 : 1.0 / m_mass0;
            var invMass1 = m_mass1 > 9999 ? 0 : 1.0 / m_mass1;

            var totalInvMass = invMass0 + invMass1;


            if (totalInvMass > 0.0) {


                var lineMat = new THREE.LineBasicMaterial({ color: 0x0000ff });

                var geom = new THREE.Geometry();
                geom.vertices.push(new THREE.Vertex(new THREE.Vector3(hitPoint[0], hitPoint[1], hitPoint[2])));

                var x = hitPoint[0] + vec3_scale(penDepth, normal)[0] * invMass0 * (1 / totalInvMass) * 10.0;
                var y = hitPoint[1] + vec3_scale(penDepth, normal)[1] * invMass0 * (1 / totalInvMass) * 10.0;
                var z = hitPoint[2] + vec3_scale(penDepth, normal)[2] * invMass0 * (1 / totalInvMass) * 10.0;


                geom.vertices.push(new THREE.Vertex(new THREE.Vector3(x, y, z)));

                line = new THREE.Line(geom, lineMat);

                debugCubes.push(line);
                sceneThree.add(line);

            }
        }
    }
}



AddForce = function (/*vec3*/p, /*vec3*/f, index) {
    if (CubeList._m_mass[index] > 9999 || CubeList._m_awake[index]==0) return;

    CubeList._m_forces[index] = vec3_plus(CubeList._m_forces[index], f);
    CubeList._m_torques[index] = vec3_plus(CubeList._m_torques[index], vec3_cross(vec3_sub(p, CubeList._m_c[index] ), f));
   
}



Cube.prototype.runCount = 0;
Cube.prototype.UpdatePos = function (dt, index) {

    if (CubeList._m_mass[index] >9999 || CubeList._m_awake[index]==0)
        return;

    CubeList._m_c[index] = vec3_add(CubeList._m_c[index], vec3_scale(dt, CubeList._m_linVelocity[index]));

    var angVel = CubeList._m_angVelocity[index];

    var quat = [angVel[0], angVel[1], angVel[2], 1];

    var Qvel = quat_scale(quat_mul(quat, CubeList._m_rot[index]), .5);

    CubeList._m_rot[index] = quat_add(CubeList._m_rot[index], quat_scale(Qvel, dt));
    CubeList._m_rot[index] = quat_normalize(CubeList._m_rot[index]);

    CubeList._m_forces[index] = [0, 0, 0];
    CubeList._m_torques[index] = [0, 0, 0];


    UpdateMatrix(index);
}


function updatePosCentersKernel(iv,m_mass,m_awake,m_c,dt)
{
	var index = iv[0];
	if(m_mass[index]>9999 || m_awake[index]==0)
		return [m_c[index][0],m_c[index][1],m_c[index][2]];
		
	var result = vec3_add(m_c[index],vec3_scale(dt,this[index]));
	return result;
} 
	
function updatePosRotKernel(iv,m_mass,m_awake,m_rot,dt)
{
		
	var index = iv[0];
	var original_rot = [m_rot[index][0],m_rot[index][1],m_rot[index][2],m_rot[index][3]];
	
	if(m_mass[index]>9999 || m_awake[index]==0)
		return [m_rot[index][0],m_rot[index][1],m_rot[index][2],m_rot[index][3]];
	
	var quat = [this[index][0],this[index][1],this[index][2],1];
	var Qvel = quat_scale(quat_mul(quat,original_rot),0.5);
	var rot = quat_add(original_rot,quat_scale(Qvel,dt));
	var result = quat_normalize(rot);
	
	return result;
}

Cube.prototype.UpdatePosOCLWithKernels = function(dt)
{
	
	//convert to parallel array because we are going to reuse them.
	var m_mass = new ParallelArray(CubeList._m_mass);
	var m_awake = new ParallelArray(CubeList._m_awake);
	
	var result = CubeList._m_linVelocity.combine(1,updatePosCentersKernel,m_mass,m_awake,CubeList._m_c,dt);
	CubeList._m_c = result.getArray();		
	
	var result = CubeList._m_angVelocity.combine(1,updatePosRotKernel,m_mass,m_awake,CubeList._m_rot,dt);
	CubeList._m_rot = result.getArray();
	
	for(index=0;index<g_numCubes;index++){
		CubeList._m_forces[index] = [0, 0, 0];
    	CubeList._m_torques[index] = [0, 0, 0];
    	UpdateMatrix(index);
	}
	
}

Cube.prototype.UpdatePosOCL = function (dt, index) {

    if (CubeList._m_mass[index] > 9999 || CubeList._m_awake[index]==0)
        return;
	
    CubeList._m_c[index] = vec3_add(CubeList._m_c[index], vec3_scale(dt, CubeList._m_linVelocity.get(index).getArray()));	

    var angVel = CubeList._m_angVelocity.get(index).getArray();

    var quat = [angVel[0], angVel[1], angVel[2], 1];

    var Qvel = quat_scale(quat_mul(quat, CubeList._m_rot[index]), .5);

    CubeList._m_rot[index] = quat_add(CubeList._m_rot[index], quat_scale(Qvel, dt));
    CubeList._m_rot[index] = quat_normalize(CubeList._m_rot[index]);

    CubeList._m_forces[index] = [0, 0, 0];
    CubeList._m_torques[index] = [0, 0, 0];


    UpdateMatrix(index);
}

function UpdateAngVelKernel(iv,m_mass,m_awake,m_torques,m_invInertia,m_angVelocity,dt)
{
	
	var index = iv[0];
    if(m_mass[index] > 9999 || m_awake[index] == 0)
    	return [m_angVelocity[index][0],m_angVelocity[index][1],m_angVelocity[index][2]];
    	
    if(dt<=0)
    	return [m_angVelocity[index][0],m_angVelocity[index][1],m_angVelocity[index][2]];
    	
    if(vec3_length(m_angVelocity[index])<0.01 )
    	return [0,0,0];
    
    var new_av = vec3_plus(m_angVelocity[index], vec3_scale(dt, vec3_transform_coord(m_torques[index], m_invInertia[index])));
        		
    //dampining
    var damping = Math.pow(0.9,dt);
    new_av = vec3_timesEquals(new_av, damping);
    return new_av;
}

function UpdateLinVelKernel(iv,m_mass,m_awake,m_forces,m_invInertia,m_linVelocity,dt, gravity)
{
	
	var index = iv[0];
	if(m_mass[index] > 9999 || m_awake[index] == 0)
    	return [0,0,0];
    	
    if(dt<=0)
    	return  [m_linVelocity[index][0],m_linVelocity[index][1],m_linVelocity[index][2]];
    	
    if(vec3_length(m_linVelocity[index])<0.01 )
    	return [0,0,0];
    	
    //gravity
    var force = vec3_plus(m_forces[index], [0,gravity*m_mass[index],0]);
    
    var new_lv = vec3_plus(m_linVelocity[index], vec3_scale(dt, vec3_invScale(m_mass[index], force)));
    
    var damping = Math.pow(.9, dt);
    new_lv = vec3_timesEquals(new_lv, damping);
    
    return new_lv;
}


function clearVelocityKernel(iv,m_awake)
{
	var index = iv[0]
	if(m_awake[index]==0)
		return [0,0,0];
	return [this[index][0],this[index][1],this[index][2]];
}

function setNewVelocityKernel(iv, m_velocityUpdate, m_newVelocity) {
    var index = iv[0];
    if (m_velocityUpdate[index] == 1)
        return [m_newVelocity[index][0],m_newVelocity[index][1],m_newVelocity[index][2]];
    return [this[index][0],this[index][1],this[index][2]];
}

function setAngVelocity(cubeIndex, velocity) {

    CubeList._m_newAngVel[cubeIndex] = velocity;
}

function setLinVelocity(cubeIndex, velocity) {
    CubeList._m_newLinVel[cubeIndex] = velocity;
}



function integrateNewVelocityOCL(iv, newLinVel, originalVelocity ) {

	var index = iv[0];
    var outVel = [0,0,0];

    if (Math.abs( newLinVel[index][0] + newLinVel[index][1] + newLinVel[index][2]) > 0)
        outVel = newLinVel[index];
    else
        outVel = [originalVelocity[index][0],originalVelocity[index][1],originalVelocity[index][2]];

    return outVel;
}

// SEQUENTIAL
function integrateNewVelocity() {

    for (var i = 0; i < g_numCubes; i++) {
        if (Math.abs( CubeList._m_newLinVel[i][0] + CubeList._m_newLinVel[i][1] + CubeList._m_newLinVel[i][2])> 0)
            CubeList._m_linVelocity[i] = CubeList._m_newLinVel[i];
        if (Math.abs( CubeList._m_newAngVel[i][0] + CubeList._m_newAngVel[i][1] + CubeList._m_newAngVel[i][2]) > 0)
            CubeList._m_angVelocity[i] = CubeList._m_newAngVel[i];

        CubeList._m_newLinVel[i] = [0, 0, 0]; //<-- reset the linear velocity for the next cycle
        CubeList._m_newAngVel[i] = [0, 0, 0]; //<-- reset the linear velocity for the next cycle
    }
}



function UpdateKinetics(index,linVel,angVel)
{

	var motion = vec3_dot(linVel, linVel) + vec3_dot(angVel, angVel);

    var bias = 0.96;

    // force is so small, ignore it with  0
    if (vec3_length(linVel) < 0.1) linVel = [0, 0, 0];


    CubeList._m_rwaMotion[index] = bias * CubeList._m_rwaMotion[index] + (1 - bias) * motion;
    if (CubeList._m_rwaMotion[index] > 50) CubeList._m_rwaMotion[index] = 5.0;

    if (CubeList._m_rwaMotion[index] <= g_sleepEpsilon) {
        CubeList._m_awake[index] = 0;
        CubeList._m_linVelocity[index] = [0, 0, 0];
        CubeList._m_angVelocity[index] = [0, 0, 0];
    }
    else if (CubeList._m_rwaMotion[index] > 10 * g_sleepEpsilon) {
        CubeList._m_rwaMotion[index] = 10 * g_sleepEpsilon;
        CubeList._m_awake[index] = 1;
    }
   



} 



Cube.prototype.UpdateVel = function (dt, index) {


    if (CubeList._m_mass[index] > 9999 || CubeList._m_awake[index] == 0) {
        return;
    }
    
  
    if (vec3_length(CubeList._m_linVelocity[index]) < .01) CubeList._m_linVelocity[index] = [0, 0, 0];
    if (vec3_length(CubeList._m_angVelocity[index]) < .01) CubeList._m_angVelocity[index] = [0, 0, 0];


    // Add Gravity
    AddForce(CubeList._m_c[index], [0, g_gravity * CubeList._m_mass[index], 0], index);
       
    // Update Angular
    CubeList._m_angVelocity[index] = vec3_plus(CubeList._m_angVelocity[index], vec3_scale(dt, vec3_transform_coord(CubeList._m_torques[index], CubeList._m_invInertia[index])));

    // Update Linear
    CubeList._m_linVelocity[index] = vec3_plus(CubeList._m_linVelocity[index], vec3_scale(dt, vec3_invScale(CubeList._m_mass[index], CubeList._m_forces[index])));

    // Bit Damping
    var damping = Math.pow(.8, dt);

    CubeList._m_linVelocity[index] = vec3_scale( damping, CubeList._m_linVelocity[index] );
    CubeList._m_angVelocity[index] = vec3_scale( damping, CubeList._m_angVelocity[index] );
   

    UpdateMatrix(index);
    
    var motion = vec3_dot(CubeList._m_linVelocity[index], CubeList._m_linVelocity[index]) + vec3_dot(CubeList._m_angVelocity[index], CubeList._m_angVelocity[index]);
       
    var bias = 0.9;

    CubeList._m_rwaMotion[index] = bias * CubeList._m_rwaMotion[index] + (1 - bias) * motion;
    if (CubeList._m_rwaMotion[index] > 50) CubeList._m_rwaMotion[index] = 5;

    if (CubeList._m_rwaMotion[index] <= g_sleepEpsilon) {
        CubeList._m_awake[index] = 0;
        CubeList._m_linVelocity[index] = [0, 0, 0];
        CubeList._m_angVelocity[index] = [0, 0, 0];
    }
    else if (CubeList._m_rwaMotion[index] > 10 * g_sleepEpsilon) {
        CubeList._m_rwaMotion[index] = 10 * g_sleepEpsilon;
        CubeList._m_awake[index] = 1;
    }
}
