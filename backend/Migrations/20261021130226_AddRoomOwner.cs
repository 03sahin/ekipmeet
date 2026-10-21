using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EkipMeet.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRoomOwner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "OwnerId",
                table: "Rooms",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Rooms",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Rooms_OwnerId",
                table: "Rooms",
                column: "OwnerId");

            migrationBuilder.AddForeignKey(
                name: "FK_Rooms_Users_OwnerId",
                table: "Rooms",
                column: "OwnerId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Rooms_Users_OwnerId",
                table: "Rooms");

            migrationBuilder.DropIndex(
                name: "IX_Rooms_OwnerId",
                table: "Rooms");

            migrationBuilder.DropColumn(
                name: "OwnerId",
                table: "Rooms");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Rooms");
        }
    }
}
